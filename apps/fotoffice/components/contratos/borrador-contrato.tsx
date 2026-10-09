"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actualizarDatosContratoAction, editarBorradorContratoAction, enviarContratoAction } from "@/app/actions/contratos";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";
const MAX_TEXTO = 100_000;
const MAX_NOMBRE = 120;

type Paso = null | "actualizar" | "enviar";

/**
 * El borrador del contrato (con "Gestionar"): nombre y texto editables, "Actualizar datos" (vuelve a armar el
 * texto desde la plantilla y pisa lo editado, con confirmación) y "Enviar a firmar". Sólo se puede enviar lo
 * que está guardado: con cambios sin guardar el botón espera. Las tablas del contrato (ítems y cuotas) viajan
 * entre símbolos invisibles o raros: no hay que borrarlos. Las reglas las vuelve a mirar el servidor.
 */
export function BorradorContrato({
  contratoId,
  nombre: nombreInicial,
  texto: textoInicial,
  puedeEditar,
}: {
  contratoId: string;
  nombre: string;
  texto: string;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [nombre, setNombre] = useState(nombreInicial);
  const [texto, setTexto] = useState(textoInicial);
  const [guardado, setGuardado] = useState({ nombre: nombreInicial, texto: textoInicial });
  const [paso, setPaso] = useState<Paso>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [vaciasPorConfirmar, setVaciasPorConfirmar] = useState<string[] | null>(null);
  // El componente conserva su estado (y sus avisos) a través de `router.refresh()`; cuando el servidor trae un
  // texto o un nombre distinto (guardar, "Actualizar datos"), se reacomoda a eso sin perder el aviso.
  const [delServidor, setDelServidor] = useState({ nombre: nombreInicial, texto: textoInicial });
  if (delServidor.nombre !== nombreInicial || delServidor.texto !== textoInicial) {
    setDelServidor({ nombre: nombreInicial, texto: textoInicial });
    setNombre(nombreInicial);
    setTexto(textoInicial);
    setGuardado({ nombre: nombreInicial, texto: textoInicial });
  }
  const sinGuardar = nombre !== guardado.nombre || texto !== guardado.texto;

  function correr<T extends { ok: boolean }>(accion: () => Promise<T>, alTerminar: (r: T & { ok: true }) => void) {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await accion().catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (r.ok) alTerminar(r as T & { ok: true });
      else setError((r as { error?: string }).error ?? ERROR_CONEXION);
    });
  }

  function guardar() {
    correr(
      () => editarBorradorContratoAction(contratoId, { texto, nombre }),
      () => {
        setGuardado({ nombre, texto });
        setAviso("Cambios guardados.");
        router.refresh();
      },
    );
  }

  function actualizarDatos() {
    correr(
      () => actualizarDatosContratoAction(contratoId, true),
      (r) => {
        setPaso(null);
        const vacias = (r as { vacias?: string[] }).vacias ?? [];
        setAviso(vacias.length > 0 ? `Datos actualizados. Quedaron sin completar: ${vacias.join(", ")}.` : "Datos actualizados.");
        router.refresh();
      },
    );
  }

  function enviar(confirmarVacias = false) {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await enviarContratoAction(contratoId, undefined, confirmarVacias).catch(() => ({ ok: false as const, error: ERROR_CONEXION, vacias: undefined }));
      if (r.ok) {
        setPaso(null);
        setVaciasPorConfirmar(null);
        router.refresh();
      } else if ("vacias" in r && r.vacias && r.vacias.length > 0) {
        setVaciasPorConfirmar(r.vacias);
      } else {
        setVaciasPorConfirmar(null);
        setError(r.error);
      }
    });
  }

  if (!puedeEditar) {
    return <p className="text-sm text-[var(--fo-muted)]">Este contrato es un borrador: todavía no se mandó a firmar.</p>;
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="text-xs text-[var(--fo-muted)]">Nombre del contrato</span>
        <input className="fo-input w-full" value={nombre} maxLength={MAX_NOMBRE} disabled={pendiente} onChange={(e) => setNombre(e.target.value)} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-xs text-[var(--fo-muted)]">Texto del contrato</span>
        <textarea
          className="fo-input min-h-[24rem] w-full font-mono text-xs leading-relaxed"
          value={texto}
          maxLength={MAX_TEXTO}
          disabled={pendiente}
          onChange={(e) => setTexto(e.target.value)}
        />
      </label>
      <p className="text-xs text-[var(--fo-muted)]">
        Con # y ## se hacen títulos y con **doble asterisco** negrita. Las tablas de ítems y cuotas llevan símbolos especiales entre medio: no los borres.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || !sinGuardar} onClick={guardar}>
          {pendiente && paso === null ? "Guardando…" : "Guardar cambios"}
        </button>
        <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} aria-expanded={paso === "actualizar"} onClick={() => setPaso(paso === "actualizar" ? null : "actualizar")}>
          Actualizar datos
        </button>
        <button
          type="button"
          className="fo-btn fo-btn-secondary text-sm"
          disabled={pendiente || sinGuardar}
          aria-expanded={paso === "enviar"}
          title={sinGuardar ? "Guardá los cambios antes de enviar." : undefined}
          onClick={() => setPaso(paso === "enviar" ? null : "enviar")}
        >
          Enviar a firmar
        </button>
        {sinGuardar ? <span className="text-xs text-[var(--fo-muted)]">Tenés cambios sin guardar.</span> : null}
      </div>

      {paso === "actualizar" ? (
        <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3 text-sm">
          <p>
            Actualizar los datos vuelve a armar el contrato desde la plantilla, con los datos de hoy del pedido y de los contratantes. <strong>Pisa lo que hayas editado a mano.</strong>
          </p>
          <div className="flex gap-2">
            <button type="button" className="fo-btn fo-btn-danger-outline text-sm" disabled={pendiente} onClick={actualizarDatos}>
              Sí, actualizar y pisar mi texto
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => setPaso(null)}>
              No, dejarlo como está
            </button>
          </div>
        </div>
      ) : null}

      {paso === "enviar" ? (
        <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3 text-sm">
          <p>
            Cada contratante recibe un correo con su enlace para verificar su identidad y firmar. Una vez enviado, el texto ya no se edita: para cambiarlo hay que corregirlo y volver a enviarlo.
          </p>
          <div className="flex gap-2">
            <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={() => enviar(false)}>
              {pendiente ? "Enviando…" : "Sí, enviar ahora"}
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => setPaso(null)}>
              Todavía no
            </button>
          </div>
        </div>
      ) : null}

      {vaciasPorConfirmar ? (
        <div role="alert" className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-danger)] p-3 text-sm">
          <p>
            Estos datos quedaron sin completar en el contrato: <strong>{vaciasPorConfirmar.map((v) => `[${v}]`).join(", ")}</strong>. Si los completaste a mano en el texto, podés enviarlo igual; si no, volvé y completá los datos del pedido o del contacto.
          </p>
          <div className="flex gap-2">
            <button type="button" className="fo-btn fo-btn-danger-outline text-sm" disabled={pendiente} onClick={() => enviar(true)}>
              Enviar igual
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => setVaciasPorConfirmar(null)}>
              Volver al borrador
            </button>
          </div>
        </div>
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
    </div>
  );
}
