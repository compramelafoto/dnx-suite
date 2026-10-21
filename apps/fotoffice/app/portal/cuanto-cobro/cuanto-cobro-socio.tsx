"use client";

import type { CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { FormatoPesos } from "@/components/campos/formato-pesos";
import { SeccionPresupuestoTrabajo } from "@/components/cuanto-cobro-socio/presupuesto-trabajo";
import { SeccionValorHora } from "@/components/cuanto-cobro-socio/valor-hora";
import { PerfilForm, type PasoAgregado, type TextoDePaso } from "@/app/workspace/configuracion/precios/perfil-form";
import type { ResultadoPerfilPrecios } from "@/app/workspace/configuracion/precios/actions";

/**
 * Los pasos del perfil dichos como los cuenta el artículo de la SFPR: primero lo que necesitás
 * para vivir, después los gastos fijos, después las horas. El cálculo es el mismo del panel.
 */
const TEXTOS: Partial<Record<string, TextoDePaso>> = {
  employment: {
    title: "¿Vivís sólo de la fotografía?",
    description: "Si tenés otro ingreso, lo descontamos de lo que la fotografía tiene que cubrir cada mes.",
  },
  personal: {
    title: "Cuánto necesitás para vivir",
    description: "Lo que necesitás ganar por mes para vivir de la fotografía: vivienda, comida, servicios, salud, transporte. Mejor un número real que uno lindo.",
  },
  business: {
    title: "Gastos fijos del mes",
    description: "Lo que pagás todos los meses haya trabajo o no: alquiler del estudio, programas, publicidad, contador.",
  },
  availability: {
    title: "Tus horas",
    description:
      "Cuántas horas por semana le dedicás a la fotografía y cómo se reparten. Sólo las horas de cobertura se cobran: con ellas se paga todo lo demás.",
  },
};

const PASOS_FINALES: PasoAgregado[] = [
  {
    id: "valor-hora",
    title: "El valor de tu hora",
    description: "Lo que necesitás ganar por mes, dividido por las horas que cobrás.",
    Contenido: ({ perfil }) => <SeccionValorHora perfil={perfil} />,
  },
  {
    id: "presupuesto",
    title: "Presupuestar un trabajo",
    description: "Las horas de ese trabajo al valor de tu hora, más los gastos variables del evento.",
    Contenido: ({ perfil }) => <SeccionPresupuestoTrabajo perfil={perfil} />,
  },
];

export function CuantoCobroSocio({
  inicial,
  version,
  accion,
}: {
  inicial: CuantoCobroProfileInput;
  version: string | null;
  accion: (perfil: unknown, versionCargada?: string | null) => Promise<ResultadoPerfilPrecios>;
}) {
  return (
    <FormatoPesos modo="palabra">
      <PerfilForm inicial={inicial} version={version} accion={accion} textos={TEXTOS} pasosAgregados={PASOS_FINALES} />
    </FormatoPesos>
  );
}
