"use client";

import { useEffect, useRef } from "react";

const HELP_ITEMS = [
  {
    keys: ["W", "A", "S", "D"],
    title: "Moverse por la escena",
    description:
      "Desplazá la cámara en primera persona por el estudio. W y S avanzan y retroceden; A y D strafean a los lados. Primero hacé click en la escena para activar el puntero.",
  },
  {
    keys: ["Mouse"],
    title: "Mirar / picado / contrapicado",
    description:
      "Con el puntero bloqueado, mové el mouse para orientar la cámara: girar el encuadre, mirar en picado (hacia abajo) o contrapicado (hacia arriba). ESC libera el puntero.",
  },
  {
    keys: ["I", "K"],
    title: "Altura de cámara",
    description:
      "Con la navegación activa: I sube la altura del punto de vista; K la baja. Útil para simular trípode alto, cadera o tomas desde el suelo.",
  },
  {
    keys: ["J", "L"],
    title: "Inclinar horizonte",
    description:
      "J inclina el horizonte hacia la izquierda; L hacia la derecha (ángulo holandés). El mouse sigue controlando hacia dónde mirás.",
  },
  {
    keys: ["Espacio"],
    title: "Obturar / disparar",
    description:
      "Toma una foto con los parámetros actuales. Escucharás el sonido del obturador (apertura y cierre según el tiempo de exposición). La vista previa aparece en el mismo recuadro del visor durante 3 segundos. Las fotos quedan en la galería (botón Play junto a pantalla completa).",
  },
  {
    keys: ["V"],
    title: "Cambiar área de enfoque",
    description:
      "Recorre el punto o la zona AF activa (centro, izquierda, zonas 3×3, etc.). Funciona con Pointer Lock activo.",
  },
  {
    keys: ["C"],
    title: "Enfocar área activa",
    description:
      "Busca foco por contraste simulado en el área seleccionada. Si el AF confirma foco (AF-S o AF-C), escucharás un pitido corto; sin foco o en MF no suena. Mantener C en AF-C sigue al sujeto móvil.",
  },
  {
    keys: ["F"],
    title: "Enfocar (atajo alternativo)",
    description:
      "Igual que C: AF en el área activa. La distancia y el estado aparecen arriba del encuadre.",
  },
  {
    keys: ["Click der."],
    title: "Fijar enfoque por click",
    description:
      "Click derecho en la escena o con navegación activa (mouse mirando) para enfocar el área AF activa. Mantener en AF-C sigue al sujeto móvil, igual que C.",
  },
  {
    keys: ["Shift"],
    title: "Caminar rápido",
    description:
      "Mantené Shift mientras te movés para desplazarte más rápido por la escena y cambiar de zona de luz con agilidad.",
  },
  {
    keys: ["↑", "↓"],
    title: "Seleccionar parámetro",
    description:
      "Subí o bajá para cambiar entre ISO, tiempo de exposición, diafragma, WB, modo, compensación, visor y Display. El parámetro activo se resalta en el panel cuando no estás en pantalla completa.",
  },
  {
    keys: ["←", "→"],
    title: "Ajustar valor",
    description:
      "Con un parámetro enfocado, usá las flechas laterales para cambiar su valor. En modo A el tiempo de exposición es automático; en modo S el diafragma es automático.",
  },
  {
    keys: ["?"],
    title: "Ayuda",
    description: "Abrí esta guía de controles. En pantalla completa también podés usar el botón ? abajo a la derecha.",
  },
] as const;

export interface SimulatorHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SimulatorHelpModal({ open, onClose }: SimulatorHelpModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cod-help-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cod-help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cod-help-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cod-help-modal__header">
          <h2 id="cod-help-title" className="cod-help-modal__title">
            Ayuda — Controles
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="cod-help-modal__close"
            onClick={onClose}
            aria-label="Cerrar ayuda"
          >
            ×
          </button>
        </header>

        <p className="cod-help-modal__intro">
          Atajos de teclado del simulador. Los parámetros de cámara también se ajustan desde el panel
          derecho con click o flechas.
        </p>

        <ul className="cod-help-modal__list">
          {HELP_ITEMS.map((item) => (
            <li key={item.title} className="cod-help-modal__item">
              <div className="cod-help-modal__keys" aria-hidden="true">
                {item.keys.map((key) => (
                  <kbd key={key} className="cod-kbd cod-kbd--lg">
                    {key}
                  </kbd>
                ))}
              </div>
              <div className="cod-help-modal__text">
                <strong className="cod-help-modal__item-title">{item.title}</strong>
                <p className="cod-help-modal__item-desc">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
