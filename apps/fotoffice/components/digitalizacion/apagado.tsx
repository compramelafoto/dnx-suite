"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  APAGADO_INICIAL, CLAVE_CODIGO_AYUDANTE, COMANDO_INSTALAR, CONSULTAR_AYUDANTE_CADA_MS, RUTA_DESCARGA_AYUDANTE, casillaMarcada,
  consultarAyudante, pedirAlAyudante, segundosRestantes, transicionApagado, validarCodigo, type EstadoAyudante, type EstadoApagado, type EvaluacionFin,
} from "@/lib/digitalizacion/cliente/apagado";

const leerLocal = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardarLocal = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento local */ } };
const borrarLocal = (k: string) => { try { localStorage.removeItem(k); } catch { /* sin almacenamiento local */ } };

/** Lo que muestran el aviso de la página y la ventanita mientras hay un apagado en marcha o falló. */
export type AvisoApagado = { titulo: string; detalle: string | null; puedeCancelar: boolean; error: boolean };

export function avisoDe(estado: EstadoApagado, restan: number | null): AvisoApagado | null {
  if (estado.tipo === "cuenta") return { titulo: `La computadora se va a apagar en ${restan ?? 0} s`, detalle: "Todo quedó subido. Si todavía la necesitás, tocá Cancelar.", puedeCancelar: true, error: false };
  if (estado.tipo === "apagando") return { titulo: estado.pedido ? "Windows se apaga en 30 segundos" : "Apagando…", detalle: estado.pedido ? "Todavía podés cancelar." : null, puedeCancelar: true, error: false };
  if (estado.tipo === "error") return { titulo: "No apagamos la computadora", detalle: estado.motivo, puedeCancelar: false, error: true };
  return null;
}

/**
 * Estado del apagado para la estación: el código guardado, si el ayudante responde (al cargar y
 * cada 30 s) y la máquina de estados, que avanza sola con `fin` (lo calcula la estación).
 */
export function useApagado(fin: EvaluacionFin) {
  const [codigo, setCodigo] = useState<string | null>(null);
  const [ayudante, setAyudante] = useState<EstadoAyudante>("sin-codigo");
  const [reintento, setReintento] = useState(0);
  const [estado, despachar] = useReducer(transicionApagado, APAGADO_INICIAL);
  const [ahora, setAhora] = useState(() => Date.now());
  const pidiendoRef = useRef(false);
  const estadoRef = useRef(estado);
  useEffect(() => { estadoRef.current = estado; }, [estado]);

  useEffect(() => {
    const c = leerLocal(CLAVE_CODIGO_AYUDANTE);
    const v = c ? validarCodigo(c) : null;
    if (v?.ok) setCodigo(v.codigo);
  }, []);

  // Sólo se consulta si ya hay código: así Chrome no le pregunta por la red local a quien no lo usa.
  useEffect(() => {
    if (!codigo) { setAyudante("sin-codigo"); return; }
    let vivo = true;
    const probar = () => void consultarAyudante(codigo).then((r) => { if (vivo) setAyudante(r); });
    setAyudante("buscando");
    probar();
    const id = window.setInterval(probar, CONSULTAR_AYUDANTE_CADA_MS);
    return () => { vivo = false; window.clearInterval(id); };
  }, [codigo, reintento]);

  // Cada cambio de la estación (fase, cola, cierre) se le cuenta a la máquina.
  const claveFin = fin.tipo === "no-apagar" ? `${fin.tipo}:${fin.motivo}` : fin.tipo;
  useEffect(() => {
    despachar({ tipo: "evaluar", fin, ahora: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveFin, estado.tipo]);

  // Cuenta regresiva por reloj de pared (en segundo plano Chrome frena los temporizadores).
  useEffect(() => {
    if (estado.tipo !== "cuenta") return;
    const tic = () => { const t = Date.now(); setAhora(t); despachar({ tipo: "tic", ahora: t }); };
    tic();
    const id = window.setInterval(tic, 250);
    document.addEventListener("visibilitychange", tic);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", tic); };
  }, [estado]);

  // Al llegar a 0, se le pide el apagado al ayudante una sola vez.
  useEffect(() => {
    if (estado.tipo !== "apagando" || estado.pedido || pidiendoRef.current) return;
    if (!codigo) { despachar({ tipo: "pedido-fallo", motivo: "No hay código del ayudante guardado." }); return; }
    pidiendoRef.current = true;
    void pedirAlAyudante("apagar", codigo).then((r) => {
      pidiendoRef.current = false;
      // Si cancelaron mientras el pedido viajaba, Windows ya lo agendó: se anula.
      if (r.ok && estadoRef.current.tipo !== "apagando") void pedirAlAyudante("cancelar", codigo);
      despachar(r.ok ? { tipo: "pedido-enviado" } : { tipo: "pedido-fallo", motivo: `No apagamos la computadora: ${r.error}` });
    });
  }, [estado, codigo]);

  const cancelar = useCallback(() => {
    // Si Windows ya recibió el pedido, hay que anularlo allá también (`shutdown /a`).
    if (estado.tipo === "apagando" && codigo) void pedirAlAyudante("cancelar", codigo);
    despachar({ tipo: "cancelar" });
  }, [estado, codigo]);

  const guardarCodigo = useCallback((texto: string): string | null => {
    const v = validarCodigo(texto);
    if (!v.ok) return v.error;
    guardarLocal(CLAVE_CODIGO_AYUDANTE, v.codigo);
    setCodigo(v.codigo);
    setReintento((n) => n + 1);
    return null;
  }, []);

  const olvidarCodigo = useCallback(() => {
    borrarLocal(CLAVE_CODIGO_AYUDANTE);
    setCodigo(null);
    despachar({ tipo: "desmarcar" });
  }, []);

  // Memorizado: la ventanita se vuelve a pintar sólo cuando cambia lo que muestra.
  const restan = segundosRestantes(estado, ahora);
  const aviso = useMemo(() => avisoDe(estado, restan), [estado, restan]);

  return {
    codigo, ayudante, estado, aviso, marcada: casillaMarcada(estado),
    marcar: () => despachar({ tipo: "marcar" }), desmarcar: () => despachar({ tipo: "desmarcar" }), cancelar,
    guardarCodigo, olvidarCodigo, probarDeNuevo: () => setReintento((n) => n + 1),
  };
}

export type Apagado = ReturnType<typeof useApagado>;

const TEXTO_AYUDANTE: Record<EstadoAyudante, string> = {
  "sin-codigo": "Ayudante no detectado: falta instalarlo y escribir su código.",
  buscando: "Buscando el ayudante…",
  listo: "✓ Ayudante conectado.",
  "codigo-incorrecto": "El ayudante responde, pero no reconoce el código. Revisalo abajo.",
  bloqueado: "El ayudante se bloqueó por códigos equivocados: esperá 5 minutos y tocá «Probar de nuevo».",
  "no-detectado": "Ayudante no detectado.",
};

/** Aviso grande arriba de todo mientras cuenta, apaga o si no se pudo apagar. */
export function AvisoApagadoEnPagina({ apagado }: { apagado: Apagado }) {
  const a = apagado.aviso;
  if (!a) return null;
  return (
    <div role="alertdialog" aria-live="assertive" className={`fixed inset-x-4 top-4 z-50 mx-auto max-w-xl space-y-3 rounded-lg p-5 text-center shadow-xl ${a.error ? "fo-alert-error" : "fo-alert-warning"}`}>
      <p className="text-2xl font-bold">{a.titulo}</p>
      {a.detalle ? <p className="text-sm">{a.detalle}</p> : null}
      {a.puedeCancelar ? (
        <button type="button" className="fo-btn fo-btn-primary text-lg" onClick={apagado.cancelar}>Cancelar</button>
      ) : null}
    </div>
  );
}

/** Casilla "Apagar la computadora al terminar" con las instrucciones para instalar el ayudante. */
export function PanelApagado({ apagado }: { apagado: Apagado }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const pasosRef = useRef<HTMLDetailsElement>(null);
  const listo = apagado.ayudante === "listo";
  const enMarcha = apagado.estado.tipo === "cuenta" || apagado.estado.tipo === "apagando";

  const verPasos = () => { if (pasosRef.current) { pasosRef.current.open = true; pasosRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" }); } };
  const copiar = () => {
    void navigator.clipboard?.writeText(COMANDO_INSTALAR).then(() => { setCopiado(true); window.setTimeout(() => setCopiado(false), 2000); }).catch(() => {});
  };

  return (
    <div className="max-w-2xl space-y-2 rounded border p-3 text-sm">
      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          checked={apagado.marcada}
          disabled={!listo || enMarcha}
          onChange={(e) => (e.target.checked ? apagado.marcar() : apagado.desmarcar())}
        />
        Apagar la computadora al terminar
      </label>
      <p className="text-gray-600">
        {apagado.marcada
          ? "Cuando termine de grabar y de subir todo, vas a ver un aviso de 60 segundos para cancelar antes de que se apague."
          : TEXTO_AYUDANTE[apagado.ayudante]}{" "}
        {!listo ? <button type="button" className="underline" onClick={verPasos}>Ver cómo instalarlo</button> : null}
      </p>
      {apagado.estado.tipo === "error" ? <p className="fo-alert-error p-2">{apagado.estado.motivo}</p> : null}

      <details ref={pasosRef} className="rounded bg-gray-50 p-2">
        <summary className="cursor-pointer font-medium">Apagar la computadora al terminar (Windows)</summary>
        <div className="mt-2 space-y-3">
          <p>Se hace una sola vez en la computadora del local. Instala un ayudante chiquito que sólo atiende a FOTOFFICE y sólo desde esta misma computadora.</p>
          <ol className="ml-5 list-decimal space-y-2">
            <li>
              <a className="fo-btn fo-btn-secondary text-sm" href={RUTA_DESCARGA_AYUDANTE} download="ayudante-apagado.ps1">Descargar el ayudante</a>
            </li>
            <li>
              En la carpeta Descargas, hacé clic derecho sobre <code>ayudante-apagado.ps1</code> y elegí «Ejecutar con PowerShell».
              Si Windows no lo deja, abrí PowerShell y pegá este comando:
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="block break-all rounded bg-white p-2 text-xs">{COMANDO_INSTALAR}</code>
                <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={copiar}>{copiado ? "Copiado ✓" : "Copiar"}</button>
              </div>
            </li>
            <li>
              Al terminar, el ayudante muestra un código de 6 números. Escribilo acá:
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input
                  className="w-32 rounded border p-2 text-center font-mono text-lg tracking-widest"
                  inputMode="numeric" autoComplete="off" maxLength={7} placeholder="000000"
                  value={texto} onChange={(e) => { setTexto(e.target.value); setError(null); }}
                />
                <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => { const e = apagado.guardarCodigo(texto); setError(e); if (!e) setTexto(""); }}>Guardar código</button>
              </div>
              {error ? <p className="mt-1 text-red-700">{error}</p> : null}
            </li>
          </ol>
          {apagado.codigo ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>Código guardado en este navegador.</span>
              <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={apagado.probarDeNuevo}>Probar de nuevo</button>
              <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={enMarcha} onClick={apagado.olvidarCodigo}>Olvidar el código</button>
            </div>
          ) : null}
          <p className="text-gray-600">
            Si Chrome pregunta si FOTOFFICE puede acceder a otros dispositivos o apps de esta computadora, tocá «Permitir»: es la forma de hablar con el ayudante.
            ¿Perdiste el código? Volvé a ejecutar el ayudante: muestra el mismo. Para quitarlo, ejecutalo con <code>-Desinstalar</code>.
          </p>
        </div>
      </details>
    </div>
  );
}
