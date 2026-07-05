"use client";

import Button from "@/components/ui/Button";

export type AlbumReactivationBannerVariant = "accessBlocked" | "expiringNotice";

type Props = {
  variant: AlbumReactivationBannerVariant;
  visibleUntil?: Date | null;
  extensionLoading: boolean;
  extensionSuccess: boolean;
  onReactivate: () => void;
  tertiaryColor?: string | null;
};

/**
 * Cartel de reactivación del álbum (30 días extra). Ancho fluido con límites para buena legibilidad.
 */
export default function AlbumReactivationBanner({
  variant,
  visibleUntil,
  extensionLoading,
  extensionSuccess,
  onReactivate,
  tertiaryColor,
}: Props) {
  const isBlocked = variant === "accessBlocked";

  return (
    <div className="w-full min-w-0 self-stretch">
      <div
        className={[
          "w-full min-w-0 mx-auto",
          isBlocked ? "max-w-3xl sm:max-w-4xl" : "max-w-6xl",
          "rounded-xl border border-amber-200 bg-amber-50 shadow-sm",
          "px-4 py-6 sm:px-8 sm:py-8 md:px-10 md:py-9",
          "flex flex-col items-stretch text-center gap-5 sm:gap-6",
        ].join(" ")}
        role="region"
        aria-label={isBlocked ? "Álbum no disponible: opción de reactivación" : "Aviso de vencimiento del álbum"}
      >
        <div className="flex justify-center w-full shrink-0">
          <img
            src="/watermark.png"
            alt="ComprameLaFoto"
            className="w-[min(100%,10rem)] sm:w-44 md:w-52 h-auto opacity-90 object-contain"
          />
        </div>

        <div className="space-y-3 sm:space-y-4 w-full min-w-0 mx-auto">
          {isBlocked ? (
            <>
              <p className="text-amber-900 font-semibold text-[0.9375rem] sm:text-lg leading-relaxed">
                Este álbum está por eliminarse y ya no está disponible. Si querés adquirir fotos, podés
                reactivarlo y elegir las que necesites por un tiempo limitado.
              </p>
              {visibleUntil && (
                <p className="text-sm sm:text-base text-amber-800/95 leading-relaxed">
                  Eliminación programada:{" "}
                  <span className="font-medium text-amber-900">
                    {visibleUntil.toLocaleDateString("es-AR")}
                  </span>
                </p>
              )}
              <p className="text-sm sm:text-base text-amber-800 leading-relaxed">
                Podés solicitar una reactivación por 30 días. Durante el período extendido se aplican los
                recargos configurados.
              </p>
            </>
          ) : (
            <>
              <p className="text-amber-900 font-semibold text-[0.9375rem] sm:text-lg leading-relaxed">
                Este álbum está pronto a eliminarse
              </p>
              <p className="text-sm sm:text-base text-amber-800 leading-relaxed">
                Podés reactivarlo por 30 días. Durante el período extendido se aplican los recargos
                configurados.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full min-w-0 pt-1">
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={onReactivate}
            disabled={extensionLoading || extensionSuccess}
            accentColor={tertiaryColor ?? undefined}
            className="w-full justify-center text-base sm:text-lg min-h-12 sm:min-h-14 px-6 py-3 sm:w-auto sm:min-w-[16rem]"
          >
            {extensionSuccess
              ? "Solicitado ✅"
              : extensionLoading
                ? "Solicitando…"
                : "Reactivar 30 días"}
          </Button>
        </div>
      </div>
    </div>
  );
}
