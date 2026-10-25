"use client";

import { useState } from "react";
import { invitarAlumnosSinCargo, type InvitacionState } from "@/app/actions/course-invitations";

const ETIQUETA: Record<string, string> = {
  INVITADO: "Invitado",
  YA_TENIA: "Ya tenía el curso",
  CORREO_INVALIDO: "Correo inválido",
  CORREO_NO_ENVIADO: "Acceso dado, correo no enviado",
  ERROR: "Error",
};

/**
 * Invitar sin cargo a un curso grabado: por ejemplo, a los alumnos de una edición anterior.
 *
 * Cada persona recibe acceso por los meses del curso y un correo para entrar; si no tenía
 * cuenta, elige su contraseña desde ese correo. Quien ya tenía el curso no recibe nada.
 */
export function CourseInvitationSection({
  courseId,
  courseTitle,
  hayClasesListas,
}: {
  courseId: string;
  courseTitle: string;
  hayClasesListas: boolean;
}) {
  const [lista, setLista] = useState("");
  const [asunto, setAsunto] = useState(`Te invitamos a ${courseTitle}`);
  const [mensaje, setMensaje] = useState(
    `Creamos nuestra propia plataforma de cursos y sumamos ${courseTitle}, con todas las clases grabadas.\n\nComo fuiste parte del curso, te invitamos a entrar gratis.`,
  );
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<InvitacionState | null>(null);

  const cantidad = lista.split(/\r?\n/).filter((l) => /@/.test(l)).length;

  async function enviar() {
    if (!window.confirm(`Se van a enviar ${cantidad} invitaciones sin cargo. ¿Seguimos?`)) return;
    setEnviando(true);
    setEstado(null);
    setEstado(await invitarAlumnosSinCargo({ courseId, lista, asunto, mensaje }));
    setEnviando(false);
  }

  const invitados = estado?.resultados?.filter((r) => r.estado === "INVITADO").length ?? 0;

  return (
    <section className="fo-card space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Invitar alumnos sin cargo</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Pegá una persona por renglón: sólo el correo, o «Nombre, correo». Cada una recibe acceso
          gratis por los meses del curso y un correo para entrar; si no tenía cuenta, elige su
          contraseña desde ahí. Quien ya tiene el curso no recibe nada.
        </p>
      </div>

      {!hayClasesListas ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          Todavía no hay clases con el video listo: los invitados entrarían a un curso vacío.
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="fo-label">Personas</span>
        <textarea
          className="fo-input min-h-40 font-mono text-sm"
          value={lista}
          onChange={(e) => setLista(e.target.value)}
          placeholder={"Ana Pérez, ana@mail.com\nluis@mail.com"}
        />
      </label>
      <label className="block space-y-1">
        <span className="fo-label">Asunto</span>
        <input className="fo-input" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="fo-label">Texto del correo</span>
        <textarea className="fo-input min-h-32" value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
        <span className="text-xs text-[var(--fo-muted)]">
          Va después de «Hola Nombre:». Abajo se agregan solos el botón para entrar y la firma.
        </span>
      </label>

      <button
        type="button"
        className="fo-btn fo-btn-primary"
        disabled={enviando || cantidad === 0}
        onClick={() => void enviar()}
      >
        {enviando ? "Enviando…" : `Enviar ${cantidad || ""} invitaciones`.replace("  ", " ")}
      </button>

      {estado?.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {estado.error}
        </p>
      ) : null}

      {estado?.resultados ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {invitados} de {estado.resultados.length} invitados.
          </p>
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {estado.resultados.map((r) => (
              <li key={r.email} className="flex justify-between gap-3">
                <span className="truncate">{r.email}</span>
                <span className={r.estado === "INVITADO" ? "text-[var(--fo-success)]" : "text-[var(--fo-muted)]"}>
                  {ETIQUETA[r.estado]}
                  {r.detalle ? ` (${r.detalle})` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {estado?.descartados?.length ? (
        <p className="text-xs text-[var(--fo-muted)]">
          Renglones sin correo, salteados: {estado.descartados.join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
