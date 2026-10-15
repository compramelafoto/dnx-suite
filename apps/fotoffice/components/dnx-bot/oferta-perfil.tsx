"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { abrirDnxBot } from "@repo/dnx-bot/ui";
import { ENLACE_DATOS } from "@/lib/dnx-bot/aviso-privacidad";
import { debeOfrecerBot, MS_PARA_OFRECER, OFERTA, registrarVisita } from "@/lib/dnx-bot/oferta-perfil";

/**
 * Oferta de «Armalo conversando» en Configuración → Precios. El camino principal es el formulario:
 * esta tarjeta aparece sólo si la persona parece trabada (`debeOfrecerBot`). «Prefiero seguir yo»
 * la oculta por esta visita.
 */
export function OfertaArmarConversando({
  workspaceId,
  perfilCompleto,
  guardadoTrabado,
}: {
  workspaceId: string;
  perfilCompleto: boolean;
  guardadoTrabado: boolean;
}) {
  const [descartada, setDescartada] = useState(false);
  const [msEnLaPagina, setMsEnLaPagina] = useState(0);
  const [visitasPrevias, setVisitasPrevias] = useState(0);

  // Una visita = un montaje de la página. Se anota en el próximo ciclo: con el doble montaje de
  // desarrollo, el primero se cancela y la visita no cuenta dos veces.
  useEffect(() => {
    const t = setTimeout(() => {
      let almacen: Storage | null = null;
      try {
        almacen = window.localStorage;
      } catch {
        almacen = null;
      }
      setVisitasPrevias(registrarVisita(almacen, workspaceId, perfilCompleto));
    }, 0);
    return () => clearTimeout(t);
    // Sólo al llegar a la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMsEnLaPagina(MS_PARA_OFRECER), MS_PARA_OFRECER);
    return () => clearTimeout(t);
  }, []);

  const d = debeOfrecerBot({ botDisponible: true, perfilCompleto, descartada, guardadoTrabado, msEnLaPagina, visitasPrevias });
  if (!d.ofrecer) return null;
  return (
    <div role="region" aria-label={OFERTA.titulo} className="fo-card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--fo-text)]">{OFERTA.titulo}</p>
        <p className="text-xs text-[var(--fo-muted)]">
          {OFERTA.texto}{" "}
          <Link href={ENLACE_DATOS.ruta} className="text-[var(--fo-accent)] hover:underline">
            {ENLACE_DATOS.etiqueta}
          </Link>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setDescartada(true)}>
          {OFERTA.descartar}
        </button>
        <button
          type="button"
          className="fo-btn fo-btn-secondary text-sm"
          onClick={() => abrirDnxBot({ texto: OFERTA.mensajeAlBot, contexto: { pantalla: "precios" } })}
        >
          {OFERTA.boton}
        </button>
      </div>
    </div>
  );
}
