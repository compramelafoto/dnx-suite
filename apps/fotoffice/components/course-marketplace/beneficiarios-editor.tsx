"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { guardarBeneficiariosAction, buscarNegociosAction } from "@/app/actions/course-beneficiaries";
import {
  validarFilas,
  type BeneficiarioRegistrado,
  type FilaBeneficiario,
  type RolBeneficiario,
} from "@/lib/course-marketplace/beneficiarios";
import { BPS_TOTAL, formatoPorcentaje, type BeneficiarioEntrada } from "@/lib/course-marketplace/reparto";
import { SimuladorReparto } from "./simulador-reparto";

const ROLES: Array<{ valor: RolBeneficiario; etiqueta: string }> = [
  { valor: "DOCENTE", etiqueta: "Docente" },
  { valor: "PRODUCTOR", etiqueta: "Productor" },
  { valor: "INSTITUCION", etiqueta: "Institución" },
  { valor: "OTRO", etiqueta: "Otro" },
];

const ESTADOS: Record<BeneficiarioRegistrado["status"], string> = {
  INVITADO: "Invitado",
  ACEPTADO: "Aceptado",
  RECHAZADO: "Rechazado",
};

type Fila = FilaBeneficiario & {
  clave: string;
  nombre: string;
  status: BeneficiarioRegistrado["status"] | null;
};

type Resultado = { ok: true; aviso?: string } | { ok: false; errores: string[] } | null;

let contador = 0;
const nuevaClave = () => `nueva-${++contador}`;

function desdeRegistrado(r: BeneficiarioRegistrado): Fila {
  return {
    clave: r.id,
    id: r.id,
    workspaceId: r.workspaceId,
    invitedEmail: r.invitedEmail,
    role: r.role,
    shareBps: r.shareBps,
    absorbsProcessorFee: r.absorbsProcessorFee,
    nombre: r.nombre,
    status: r.status,
  };
}

export function BeneficiariosEditor({
  courseId,
  dueno,
  listaCentavos,
  comisionPlataformaBps,
  iniciales,
}: {
  courseId: string;
  dueno: { workspaceId: string; nombre: string };
  listaCentavos: number;
  comisionPlataformaBps: number;
  iniciales: BeneficiarioRegistrado[];
}) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    iniciales.length > 0
      ? iniciales.map(desdeRegistrado)
      : [
          {
            clave: nuevaClave(),
            workspaceId: dueno.workspaceId,
            invitedEmail: null,
            role: "INSTITUCION",
            shareBps: BPS_TOTAL,
            absorbsProcessorFee: true,
            nombre: dueno.nombre,
            status: "ACEPTADO",
          },
        ],
  );
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Array<{ workspaceId: string; nombre: string; slug: string }>>([]);
  const [correo, setCorreo] = useState("");
  const [resultado, setResultado] = useState<Resultado>(null);
  const [guardando, iniciarGuardado] = useTransition();
  const busqueda = useRef(0);

  const filasParaGuardar: FilaBeneficiario[] = filas.map((f) => ({
    id: f.id,
    workspaceId: f.workspaceId,
    invitedEmail: f.invitedEmail,
    role: f.role,
    shareBps: f.shareBps,
    absorbsProcessorFee: f.absorbsProcessorFee,
  }));
  const errores = useMemo(() => validarFilas(filasParaGuardar), [filas]); // eslint-disable-line react-hooks/exhaustive-deps
  const suma = filas.reduce((s, f) => s + (Number.isFinite(f.shareBps) ? f.shareBps : 0), 0);

  const paraMotor: BeneficiarioEntrada[] = useMemo(
    () =>
      filas.map((f) => ({
        id: f.workspaceId ?? f.invitedEmail ?? f.clave,
        nombre: f.nombre,
        bps: f.shareBps,
        absorbeMp: f.absorbsProcessorFee,
      })),
    [filas],
  );

  function cambiar(clave: string, cambios: Partial<Fila>) {
    setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
    setResultado(null);
  }

  function absorbe(clave: string) {
    setFilas((prev) => prev.map((f) => ({ ...f, absorbsProcessorFee: f.clave === clave })));
    setResultado(null);
  }

  function quitar(clave: string) {
    setFilas((prev) => prev.filter((f) => f.clave !== clave));
    setResultado(null);
  }

  async function buscar(valor: string) {
    setTexto(valor);
    const turno = ++busqueda.current;
    if (valor.trim().length < 2) {
      setResultados([]);
      return;
    }
    const encontrados = await buscarNegociosAction(valor);
    if (turno === busqueda.current) setResultados(encontrados);
  }

  function agregarNegocio(n: { workspaceId: string; nombre: string }) {
    if (filas.some((f) => f.workspaceId === n.workspaceId)) return;
    setFilas((prev) => [
      ...prev,
      {
        clave: nuevaClave(),
        workspaceId: n.workspaceId,
        invitedEmail: null,
        role: "OTRO",
        shareBps: 0,
        absorbsProcessorFee: false,
        nombre: n.nombre,
        status: null,
      },
    ]);
    setTexto("");
    setResultados([]);
    setResultado(null);
  }

  function agregarCorreo() {
    const valor = correo.trim().toLowerCase();
    if (!valor) return;
    setFilas((prev) => [
      ...prev,
      {
        clave: nuevaClave(),
        workspaceId: null,
        invitedEmail: valor,
        role: "OTRO",
        shareBps: 0,
        absorbsProcessorFee: false,
        nombre: valor,
        status: null,
      },
    ]);
    setCorreo("");
    setResultado(null);
  }

  function guardar() {
    iniciarGuardado(async () => {
      setResultado(await guardarBeneficiariosAction(courseId, filasParaGuardar));
    });
  }

  const faltan = BPS_TOTAL - suma;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--fo-muted)]">
        Con el reparto automático de Mercado Pago todavía apagado, un curso con varios beneficiarios se puede armar y
        simular, pero en la página de venta dice &quot;Disponible próximamente&quot;.
      </p>

      <section className="fo-card space-y-3">
        <h3 className="text-base font-semibold">Beneficiarios</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--fo-muted)]">
                <th className="py-1 pr-2">Quién</th>
                <th className="py-1 pr-2">Rol</th>
                <th className="py-1 pr-2">%</th>
                <th className="py-1 pr-2">Absorbe comisión MP</th>
                <th className="py-1 pr-2">Estado</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.clave} className="border-t border-[var(--fo-border)]">
                  <td className="py-2 pr-2">{f.nombre}</td>
                  <td className="py-2 pr-2">
                    <select
                      className="fo-input"
                      value={f.role}
                      onChange={(e) => cambiar(f.clave, { role: e.target.value as RolBeneficiario })}
                      aria-label={`Rol de ${f.nombre}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r.valor} value={r.valor}>
                          {r.etiqueta}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      className="fo-input w-24"
                      value={f.shareBps / 100}
                      onChange={(e) => cambiar(f.clave, { shareBps: Math.round(Number(e.target.value || 0) * 100) })}
                      aria-label={`Porcentaje de ${f.nombre}`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="radio"
                      name="absorbe-mp"
                      checked={f.absorbsProcessorFee}
                      onChange={() => absorbe(f.clave)}
                      aria-label={`${f.nombre} absorbe la comisión de Mercado Pago`}
                    />
                  </td>
                  <td className="py-2 pr-2">{f.status ? ESTADOS[f.status] : "Nuevo"}</td>
                  <td className="py-2 text-right">
                    <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => quitar(f.clave)}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className={`text-sm ${faltan === 0 ? "" : "text-[var(--fo-danger)]"}`}>
          Suman {formatoPorcentaje(suma)}
          {faltan > 0 ? `: faltan ${formatoPorcentaje(faltan)}` : faltan < 0 ? `: sobran ${formatoPorcentaje(-faltan)}` : "."}
        </p>
        {errores.length > 0 ? (
          <ul className="list-disc pl-5 text-sm text-[var(--fo-danger)]">
            {errores.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        <div className="space-y-2 border-t border-[var(--fo-border)] pt-3">
          <label className="fo-label" htmlFor="buscar-negocio">
            Agregar beneficiario (buscá su negocio)
          </label>
          <input
            id="buscar-negocio"
            className="fo-input"
            value={texto}
            onChange={(e) => void buscar(e.target.value)}
            placeholder="Nombre o dirección del negocio"
          />
          {resultados.length > 0 ? (
            <ul className="space-y-1">
              {resultados.map((n) => (
                <li key={n.workspaceId}>
                  <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => agregarNegocio(n)}>
                    {n.nombre} <span className="text-[var(--fo-muted)]">({n.slug})</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <label className="fo-label" htmlFor="invitar-correo">
            o invitar por correo
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="invitar-correo"
              type="email"
              className="fo-input max-w-xs"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="correo@ejemplo.com"
            />
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={agregarCorreo}>
              Agregar
            </button>
          </div>
        </div>

        <div className="space-y-2 border-t border-[var(--fo-border)] pt-3">
          <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={guardando} onClick={guardar}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
          {resultado?.ok === false ? (
            <ul className="list-disc pl-5 text-sm text-[var(--fo-danger)]">
              {resultado.errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          {resultado?.ok === true ? (
            <p className="text-sm">
              Guardado.{resultado.aviso ? ` ${resultado.aviso}` : ""}
            </p>
          ) : null}
        </div>
      </section>

      <SimuladorReparto
        listaCentavos={listaCentavos}
        comisionPlataformaBps={comisionPlataformaBps}
        beneficiarios={paraMotor}
        vendedorId={dueno.workspaceId}
        destacarId={dueno.workspaceId}
      />
    </div>
  );
}
