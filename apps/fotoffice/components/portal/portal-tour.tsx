"use client";

import { useMemo } from "react";
import { GuidedTour, type TourDefinition } from "@repo/guided-tour";

/**
 * El recorrido guiado del portal del socio.
 *
 * Lo monta el marco del portal (una sola vez, en todas sus pantallas), pero los pasos apuntan a
 * la portada y al menú lateral. Las secciones del menú se encienden por módulos según la
 * institución: cada ítem lleva su propio `data-tour`, y el paso cuya sección no existe se
 * saltea solo. Si el socio no está en la portada, se saltean los pasos de la portada.
 *
 * Es de cliente porque la definición no viaja bien del servidor al navegador; acá vive entera.
 */

export const PORTAL_TOUR_ID = "portal-socio";

/** El acento del portal (`--fo-accent` en globals.css). El motor necesita un color hexadecimal. */
const ACENTO_PORTAL = "#0ea5e9";

const menu = (...secciones: string[]) => secciones.map((s) => `[data-tour="portal-menu-${s}"]`).join(", ");

function portalTour(persona: string): TourDefinition {
  return {
    id: PORTAL_TOUR_ID,
    version: 1,
    screenName: "tu portal de socio",
    intro: "Te mostramos en un minuto dónde está cada cosa de tu portal.",
    steps: [
      {
        title: "Te damos la bienvenida",
        body: `Acá tenés en un solo lugar tus cuotas, tu carnet y todo lo que te da ser ${persona} de la institución.`,
      },
      {
        target: '[data-tour="portal-tablero"]',
        title: "Tu situación de un vistazo",
        body: "En la portada ves si tu cuenta está al día, si tu carnet está vigente, tu categoría y tu antigüedad.",
        placement: "bottom",
      },
      {
        target: '[data-tour="portal-cuotas"]',
        title: "Tus cuotas",
        body: "Te muestra lo que tenés pendiente. Con el botón de abajo entrás al detalle y, si debés algo, lo pagás desde ahí.",
      },
      {
        target: '[data-tour="portal-carnet"]',
        title: "Tu carnet digital",
        body: `Tocá la tarjeta para abrir tu carnet, con el código que acredita que sos ${persona}. Lo podés mostrar desde el celular.`,
        placement: "left",
      },
      {
        target: '[data-tour="portal-campanita"]',
        title: "Novedades",
        body: "La campanita te avisa lo nuevo de la institución. El número rojo cuenta lo que todavía no viste.",
        placement: "bottom",
      },
      {
        target: '[data-tour="portal-menu"]',
        title: "El menú del portal",
        body: "Desde acá vas a cualquier sección. Lo que tu institución todavía no tiene activo aparece abajo, en «Próximas funcionalidades».",
        placement: "right",
      },
      {
        target: menu("perfil"),
        title: "Tu perfil",
        body: "Tus datos personales, tu foto y a qué te dedicás. Tenelos al día para que la institución sepa cómo encontrarte.",
        placement: "right",
      },
      {
        target: menu("portfolio"),
        title: "Tu portfolio",
        body: "Subí tus fotos para que se publiquen en el sitio de la institución.",
        placement: "right",
      },
      {
        target: menu("beneficios", "sorteos"),
        title: "Beneficios y sorteos",
        body: `En Beneficios están los descuentos y convenios por ser ${persona}; en Sorteos, el sorteo del mes y los resultados de los anteriores.`,
        placement: "right",
      },
      {
        target: menu("cursos", "concursos"),
        title: "Cursos y concursos",
        body: `En Cursos ves tus cursos y los que te tocan gratis por ser ${persona}; en Concursos, los concursos y maratones abiertos para participar.`,
        placement: "right",
      },
      {
        target: menu("reservas", "coberturas"),
        title: "Reservas y coberturas",
        body: "En Reservas pedís el salón, el estudio o el coworking; en Coberturas te anotás como voluntario en las convocatorias abiertas.",
        placement: "right",
      },
      {
        target: menu("cuanto-cobro", "fotolibros"),
        title: "Herramientas para tu trabajo",
        body: "¿Cuánto Cobro? te ayuda a calcular el precio de un trabajo sin regalarlo, y Mis fotolibros te deja diseñar fotolibros listos para el laboratorio.",
        placement: "right",
      },
      {
        target: menu("proyectos", "tareas", "recomendados"),
        title: "Participar en la institución",
        body: "En Mis proyectos proponés ideas a la comisión, en Mis tareas seguís lo que te encargaron y en Mis recomendados ves a quién invitaste.",
        placement: "right",
      },
      {
        target: '[data-tour="ayuda"]',
        title: "¿Te perdiste?",
        body: "Tocá «Ayuda» cuando quieras para volver a ver este recorrido.",
        placement: "right",
      },
    ],
  };
}

export function PortalTour({ persona }: { persona: string }) {
  const tour = useMemo(() => portalTour(persona), [persona]);
  return <GuidedTour tour={tour} accentColor={ACENTO_PORTAL} />;
}
