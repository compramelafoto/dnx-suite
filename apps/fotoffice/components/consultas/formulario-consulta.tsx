"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buscarContactosAction, crearConsultaAction } from "@/app/actions/consultas";
import type { GrupoConsulta } from "@/lib/consultas/constantes";
import type { FormEvento } from "@/lib/consultas/formulario";
import { AvisosConsulta, type AvisosVista } from "./avisos-consulta";
import { CamposEvento } from "./campos-evento";
import { SelectorContacto, type ContactoElegido } from "./selector-contacto";

const MENSAJE_FALLA = "No se pudo guardar la consulta. Probá de nuevo.";

type Opcion = { id: string; nombre: string };

const soloDigitos = (v: string) => v.replace(/\D/g, "");

/**
 * "Nueva consulta" (spec §3.1): contacto (buscado o nuevo), categoría con los datos de su grupo,
 * origen, referente, valor, cierre previsto, responsable y nota. Al guardar va a la ficha; si hay
 * avisos (fecha superpuesta o posible duplicado), primero los muestra.
 */
export function FormularioConsulta({
  categorias,
  origenes,
  responsables,
  contactoInicial,
}: {
  categorias: (Opcion & { grupo: GrupoConsulta })[];
  origenes: Opcion[];
  responsables: { id: number; nombre: string }[];
  contactoInicial: ContactoElegido | null;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [modo, setModo] = useState<"buscar" | "nuevo">("buscar");
  const [contacto, setContacto] = useState<ContactoElegido | null>(contactoInicial);
  const [nuevo, setNuevo] = useState({ nombre: "", email: "", telefono: "" });
  const [existentes, setExistentes] = useState<ContactoElegido[]>([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [evento, setEvento] = useState<FormEvento>({});
  const [origenId, setOrigenId] = useState("");
  const [referente, setReferente] = useState<ContactoElegido | null>(null);
  const [valor, setValor] = useState("");
  const [cierre, setCierre] = useState("");
  const [responsable, setResponsable] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<{ leadId: string; avisos: AvisosVista } | null>(null);

  const grupo = categorias.find((c) => c.id === categoriaId)?.grupo ?? null;

  // "Contacto nuevo": si el correo o el teléfono ya existen, ofrece usar ese contacto.
  const email = nuevo.email.trim().toLowerCase();
  const telefono = soloDigitos(nuevo.telefono);
  const buscaExistentes = modo === "nuevo" && (email.includes("@") || telefono.length >= 6);
  useEffect(() => {
    if (!buscaExistentes) return;
    let vigente = true;
    const espera = setTimeout(async () => {
      try {
        const pedidos = [...(email.includes("@") ? [email] : []), ...(telefono.length >= 6 ? [telefono] : [])];
        const respuestas = await Promise.all(pedidos.map((p) => buscarContactosAction(p)));
        if (!vigente) return;
        const vistos = new Map<string, ContactoElegido>();
        for (const r of respuestas) {
          if (!r.ok) continue;
          for (const c of r.contactos) {
            const mismoCorreo = !!email && c.email?.trim().toLowerCase() === email;
            const mismoTelefono = telefono.length >= 6 && !!c.telefono && soloDigitos(c.telefono) === telefono;
            if (mismoCorreo || mismoTelefono) vistos.set(c.id, c);
          }
        }
        setExistentes([...vistos.values()]);
      } catch {
        if (vigente) setExistentes([]);
      }
    }, 400);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [buscaExistentes, email, telefono]);
  // Con el correo y el teléfono borrados (o en "Buscar contacto") no queda ningún aviso.
  const duplicadosVisibles = buscaExistentes ? existentes : [];

  function enviar() {
    setError(null);
    let datosContacto: { clientId: string } | { nombre: string; email: string; telefono: string };
    if (modo === "buscar") {
      if (!contacto) {
        setError("Elegí un contacto o cargá uno nuevo.");
        return;
      }
      datosContacto = { clientId: contacto.id };
    } else {
      if (!nuevo.nombre.trim()) {
        setError("Escribí el nombre del contacto nuevo.");
        return;
      }
      datosContacto = { nombre: nuevo.nombre, email: nuevo.email, telefono: nuevo.telefono };
    }
    if (!categoriaId) {
      setError("Elegí una categoría.");
      return;
    }
    iniciar(async () => {
      try {
        const r = await crearConsultaAction({
          contacto: datosContacto,
          categoriaId,
          evento,
          origenId: origenId || null,
          referenteClientId: referente?.id ?? null,
          valor,
          cierrePrevisto: cierre,
          responsableUserId: responsable ? Number(responsable) : null,
          nota,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        const hayAvisos = (r.avisos.fechaSuperpuesta?.length ?? 0) > 0 || (r.avisos.duplicados?.length ?? 0) > 0;
        if (hayAvisos) setCreada({ leadId: r.leadId, avisos: r.avisos });
        else router.push(`/consultas/${r.leadId}`);
      } catch {
        setError(MENSAJE_FALLA);
      }
    });
  }

  if (creada) {
    return (
      <section className="fo-card space-y-3" aria-labelledby="creada-titulo">
        <h2 id="creada-titulo" className="text-base font-semibold text-[var(--fo-text)]">
          La consulta quedó cargada
        </h2>
        <AvisosConsulta avisos={creada.avisos} />
        <Link href={`/consultas/${creada.leadId}`} className="fo-btn fo-btn-primary inline-flex text-sm">
          Ir a la consulta
        </Link>
      </section>
    );
  }

  return (
    <form
      className="fo-card max-w-3xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      aria-label="Nueva consulta"
    >
      <fieldset className="space-y-3" disabled={pendiente}>
        <legend className="text-base font-semibold text-[var(--fo-text)]">Contacto</legend>
        <div className="flex gap-2 text-sm" role="group" aria-label="Contacto existente o nuevo">
          <button
            type="button"
            className={`fo-btn text-sm ${modo === "buscar" ? "fo-btn-primary" : "fo-btn-secondary"}`}
            aria-pressed={modo === "buscar"}
            onClick={() => setModo("buscar")}
          >
            Buscar contacto
          </button>
          <button
            type="button"
            className={`fo-btn text-sm ${modo === "nuevo" ? "fo-btn-primary" : "fo-btn-secondary"}`}
            aria-pressed={modo === "nuevo"}
            onClick={() => setModo("nuevo")}
          >
            Contacto nuevo
          </button>
        </div>
        {modo === "buscar" ? (
          <SelectorContacto etiqueta="Contacto" elegido={contacto} onElegir={setContacto} />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="fo-field-stack">
                <span className="fo-label">Nombre y apellido</span>
                <input className="fo-input" value={nuevo.nombre} maxLength={200} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
              </label>
              <label className="fo-field-stack">
                <span className="fo-label">Correo</span>
                <input type="email" className="fo-input" value={nuevo.email} maxLength={254} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
              </label>
              <label className="fo-field-stack">
                <span className="fo-label">Teléfono</span>
                <input type="tel" className="fo-input" value={nuevo.telefono} maxLength={40} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
              </label>
            </div>
            {duplicadosVisibles.length > 0 ? (
              <div role="status" className="rounded-lg border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-3 text-sm">
                <p className="font-medium text-[var(--fo-text)]">Posible duplicado</p>
                <p className="text-[var(--fo-muted)]">Ya hay un contacto con ese correo o teléfono. ¿Usamos ese en lugar de crear otro?</p>
                <ul className="mt-2 space-y-1">
                  {duplicadosVisibles.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--fo-text)]">{c.nombre}</span>
                      <span className="text-xs text-[var(--fo-muted)]">{[c.email, c.telefono].filter(Boolean).join(" · ")}</span>
                      <button
                        type="button"
                        className="fo-btn fo-btn-secondary text-xs"
                        onClick={() => {
                          setContacto(c);
                          setModo("buscar");
                        }}
                      >
                        Usar este contacto
                      </button>
                      <Link href={`/clientes/${c.id}`} className="text-xs text-[var(--fo-accent)] hover:underline">
                        Ver ficha
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3" disabled={pendiente}>
        <legend className="text-base font-semibold text-[var(--fo-text)]">Consulta</legend>
        <label className="fo-field-stack">
          <span className="fo-label">Categoría</span>
          <select className="fo-input" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Elegí una categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <CamposEvento grupo={grupo} valor={evento} onCambiar={setEvento} deshabilitado={pendiente} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="fo-field-stack">
            <span className="fo-label">Origen</span>
            <select className="fo-input" value={origenId} onChange={(e) => setOrigenId(e.target.value)}>
              <option value="">Sin especificar</option>
              {origenes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Responsable</span>
            <select className="fo-input" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
              <option value="">El de la configuración</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Valor estimado</span>
            <input className="fo-input" inputMode="decimal" placeholder="Ej.: 350.000" value={valor} maxLength={20} onChange={(e) => setValor(e.target.value)} />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Cierre previsto</span>
            <input type="date" className="fo-input" value={cierre} onChange={(e) => setCierre(e.target.value)} />
          </label>
        </div>
        <SelectorContacto
          etiqueta="Referente (quién la recomendó)"
          elegido={referente}
          onElegir={setReferente}
          excluir={contacto && modo === "buscar" ? [contacto.id] : undefined}
          deshabilitado={pendiente}
        />
        <label className="fo-field-stack">
          <span className="fo-label">Mensaje o nota inicial</span>
          <textarea className="fo-input" rows={4} maxLength={4000} value={nota} onChange={(e) => setNota(e.target.value)} />
        </label>
      </fieldset>

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar consulta"}
        </button>
        <Link href="/consultas" className="fo-btn fo-btn-secondary text-sm">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
