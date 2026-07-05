"use client";

import { useState } from "react";
import Image from "next/image";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export type PreferenciasMarcaSectionProps = {
  loading: boolean;
  onSave: () => void;
  logoUrl: string | null;
  logoFile: File | null;
  setLogoFile: (file: File | null) => void;
  onLogoUpload: () => void;
  onLogoValidationError: (message: string) => void;
  primaryColor: string;
  setPrimaryColor: (v: string) => void;
  secondaryColor: string;
  setSecondaryColor: (v: string) => void;
  tertiaryColor: string;
  setTertiaryColor: (v: string) => void;
  fontColor: string;
  setFontColor: (v: string) => void;
  headerBackgroundColor: string;
  setHeaderBackgroundColor: (v: string) => void;
  footerBackgroundColor: string;
  setFooterBackgroundColor: (v: string) => void;
  heroBackgroundColor: string;
  setHeroBackgroundColor: (v: string) => void;
  pageBackgroundColor: string;
  setPageBackgroundColor: (v: string) => void;
  isPublicPageEnabled: boolean;
  setIsPublicPageEnabled: (v: boolean) => void;
  publicPageHandler: string;
  setPublicPageHandler: (v: string) => void;
  enableAlbumsPage: boolean;
  setEnableAlbumsPage: (v: boolean) => void;
  enablePrintPage: boolean;
  setEnablePrintPage: (v: boolean) => void;
  showCarnetPrints: boolean;
  setShowCarnetPrints: (v: boolean) => void;
  showPolaroidPrints: boolean;
  setShowPolaroidPrints: (v: boolean) => void;
  copied: boolean;
  setCopied: (v: boolean) => void;
  copiedHtml: boolean;
  setCopiedHtml: (v: boolean) => void;
};

function ColorField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">{label}</label>
      <div className="flex gap-2">
        <Input
          type="color"
          value={value || placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 h-12 p-1 shrink-0"
        />
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          pattern="^#[0-9A-Fa-f]{6}$"
        />
      </div>
      <p className="text-xs text-[#6b7280] mt-1">{hint}</p>
    </div>
  );
}

export default function PreferenciasMarcaSection({
  loading,
  onSave,
  logoUrl,
  logoFile,
  setLogoFile,
  onLogoUpload,
  onLogoValidationError,
  primaryColor,
  setPrimaryColor,
  secondaryColor,
  setSecondaryColor,
  tertiaryColor,
  setTertiaryColor,
  fontColor,
  setFontColor,
  headerBackgroundColor,
  setHeaderBackgroundColor,
  footerBackgroundColor,
  setFooterBackgroundColor,
  heroBackgroundColor,
  setHeroBackgroundColor,
  pageBackgroundColor,
  setPageBackgroundColor,
  isPublicPageEnabled,
  setIsPublicPageEnabled,
  publicPageHandler,
  setPublicPageHandler,
  enableAlbumsPage,
  setEnableAlbumsPage,
  enablePrintPage,
  setEnablePrintPage,
  showCarnetPrints,
  setShowCarnetPrints,
  showPolaroidPrints,
  setShowPolaroidPrints,
  copied,
  setCopied,
  copiedHtml,
  setCopiedHtml,
}: PreferenciasMarcaSectionProps) {
  const [embedCodeOpen, setEmbedCodeOpen] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const hostPrefix =
    typeof window !== "undefined"
      ? `${window.location.host}/`
      : "compramelafoto.com/";
  const handlerSlug = publicPageHandler.trim();
  const publicUrl = handlerSlug ? `${origin}/${handlerSlug}` : null;
  const embedHtml = handlerSlug
    ? `<iframe src="${origin || "https://compramelafoto.com"}/${handlerSlug}?embed=1" width="100%" height="800" frameborder="0" style="border: none; min-height: 800px;"></iframe>`
    : "";

  async function copyText(text: string, onDone: () => void) {
    try {
      await navigator.clipboard.writeText(text);
      onDone();
    } catch {
      const textArea = document.createElement("textarea");
      textArea.className = "ds-textarea-opt-out";
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        onDone();
      } catch (e) {
        console.error("Error copiando:", e);
      }
      document.body.removeChild(textArea);
    }
  }

  return (
    <div className="ds-tab-panel space-y-6 w-full min-w-0">
      <div className="ds-content-container max-w-3xl">
        <h2 className="text-xl font-medium text-[#1a1a1a] m-0">Preferencias y marca</h2>
        <p className="ds-intro-prose text-sm text-[#6b7280] mt-2 mb-0">
          Configurá tu página pública, la identidad visual y las opciones que verán tus clientes.
        </p>
      </div>

      {/* Bloque 1 — Página pública */}
      <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="ds-content-container min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-[#1a1a1a] m-0">Página pública personalizada</h3>
            <p className="text-sm leading-relaxed text-[#6b7280] mt-2 mb-0">
              Una landing con tu marca para que tus clientes encuentren álbumes, impresión y tus enlaces en un solo
              lugar.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center self-start rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
              isPublicPageEnabled
                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                : "bg-[#f3f4f6] text-[#6b7280] ring-1 ring-[#e5e7eb]"
            )}
          >
            {isPublicPageEnabled ? "Activa" : "Inactiva"}
          </span>
        </div>

        <div className="mt-6 rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={isPublicPageEnabled}
              onChange={(e) => setIsPublicPageEnabled(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-[#c27b3d]"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-[#1a1a1a]">
                Habilitar página pública personalizada
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-[#6b7280]">
                Al activarla, tus clientes podrán entrar por una URL propia con tu logo y colores.
              </span>
            </span>
          </label>
        </div>

        {!isPublicPageEnabled && (
          <p className="mt-4 rounded-xl border border-dashed border-[#e5e7eb] bg-white p-4 text-sm leading-relaxed text-[#6b7280] m-0">
            Al activarla vas a poder configurar la dirección, copiar el enlace y obtener el código para insertarla en
            tu web.
          </p>
        )}

        {isPublicPageEnabled && (
          <div className="mt-6 space-y-6 border-t border-[#e5e7eb] pt-6">
            <section className="w-full min-w-0 space-y-3">
              <h4 className="text-sm font-semibold text-[#1a1a1a] m-0">Dirección de tu página</h4>
              <label className="block text-sm font-medium text-[#1a1a1a]" htmlFor="public-page-handler">
                Dirección de tu página
              </label>
              <div className="flex w-full min-w-0 overflow-hidden rounded-2xl border border-[#111827]/10 bg-white shadow-sm focus-within:ring-2 focus-within:ring-[#c27b3d] focus-within:border-transparent">
                <span className="flex shrink-0 items-center border-r border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 text-sm text-[#6b7280] sm:px-4">
                  {hostPrefix}
                </span>
                <input
                  id="public-page-handler"
                  type="text"
                  placeholder="juanfoto"
                  value={publicPageHandler}
                  onChange={(e) =>
                    setPublicPageHandler(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }
                  pattern="^[a-z0-9-]+$"
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-base text-[#111827] placeholder:text-[#9ca3af] focus:outline-none sm:px-4"
                />
              </div>
              <p className="text-xs text-[#6b7280] m-0">Solo letras minúsculas, números y guiones.</p>
            </section>

            <section className="w-full min-w-0 rounded-xl border border-[#e5e7eb] bg-white p-4 sm:p-5">
              <p className="text-sm font-medium text-[#1a1a1a] m-0">Vista previa del enlace</p>
              <p className="mt-1 text-sm text-[#6b7280] m-0">Tu página estará disponible en:</p>
              {publicUrl ? (
                <>
                  <p className="mt-3 break-all font-mono text-sm text-[#c27b3d] leading-relaxed">{publicUrl}</p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-[#c27b3d] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto sm:order-2"
                    >
                      Ver página
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(publicUrl, () => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        })
                      }
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-2.5 text-sm font-medium text-[#1a1a1a] transition-colors hover:bg-white sm:w-auto sm:order-1"
                    >
                      {copied ? "Enlace copiado" : "Copiar enlace"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-[#6b7280] m-0">
                  Escribí un nombre para la dirección (por ejemplo <span className="font-mono">juanfoto</span>) y
                  guardá los cambios para generar el enlace.
                </p>
              )}
            </section>

            {handlerSlug ? (
              <section className="w-full min-w-0 rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-[#1a1a1a] m-0">Insertar en mi web</h4>
                    <p className="mt-1 text-sm text-[#6b7280] m-0">
                      Usá este código si querés mostrar tu página dentro de otro sitio.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmbedCodeOpen((open) => !open)}
                    className="inline-flex w-full shrink-0 items-center justify-center rounded-2xl border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#4b5563] transition-colors hover:border-[#c27b3d]/40 hover:text-[#c27b3d] sm:w-auto"
                  >
                    {embedCodeOpen ? "Ocultar código" : "Mostrar código"}
                  </button>
                </div>
                {embedCodeOpen && (
                  <div className="mt-4 space-y-3 border-t border-[#e5e7eb] pt-4">
                    <p className="text-xs text-[#6b7280] m-0">
                      La versión incrustada no muestra el logo de ComprameLaFoto.
                    </p>
                    <pre className="max-h-40 overflow-x-auto overflow-y-auto rounded-lg border border-[#e5e7eb] bg-white p-3 font-mono text-xs leading-relaxed text-[#374151] whitespace-pre-wrap break-all">
                      {embedHtml}
                    </pre>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          copyText(embedHtml, () => {
                            setCopiedHtml(true);
                            setTimeout(() => setCopiedHtml(false), 2000);
                          })
                        }
                        className="inline-flex w-full items-center justify-center rounded-2xl border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#f9fafb] sm:w-auto"
                      >
                        {copiedHtml ? "Código copiado" : "Copiar código"}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            ) : null}
          </div>
        )}
      </Card>

      {/* Bloque 2 — Identidad visual (visible cuando la página pública está activa o para preparar marca) */}
      <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6 space-y-5">
        <div>
          <h3 className="text-lg font-medium text-[#1a1a1a] m-0">Identidad visual</h3>
          <p className="text-sm text-[#6b7280] mt-2 mb-0">
            Logo y colores de tu landing. Se aplican cuando la página pública está habilitada.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Logo (PNG)</label>
          <p className="text-xs text-[#6b7280] mb-3">
            Se muestra en la barra superior de tu página. Recomendado: 180×54 px.
          </p>
          {logoUrl && (
            <div className="mb-4 p-4 border border-[#e5e7eb] rounded-lg bg-[#f8f9fa]">
              <Image
                src={logoUrl}
                alt="Logo actual"
                width={180}
                height={54}
                className="h-12 w-auto object-contain"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-3 items-center">
            <Input
              type="file"
              accept="image/png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.type !== "image/png") {
                  onLogoValidationError("El archivo debe ser PNG");
                  return;
                }
                setLogoFile(file);
              }}
              className="py-2 max-w-md"
            />
            {logoFile && (
              <Button variant="primary" onClick={onLogoUpload} disabled={loading}>
                {loading ? "Subiendo…" : "Subir logo"}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-base font-medium text-[#1a1a1a] m-0">Colores principales</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ColorField
              label="Color principal"
              hint="Botones, enlaces e íconos destacados."
              value={primaryColor}
              onChange={setPrimaryColor}
              placeholder="#c27b3d"
            />
            <ColorField
              label="Color secundario"
              hint="Respaldo de header, footer y fondos suaves."
              value={secondaryColor}
              onChange={setSecondaryColor}
              placeholder="#2d2d2d"
            />
            <ColorField
              label="Color terciario"
              hint="Bordes de tarjetas y botones secundarios."
              value={tertiaryColor}
              onChange={setTertiaryColor}
              placeholder="#c27b3d"
            />
            <ColorField
              label="Color de texto"
              hint="Títulos y párrafos en la landing."
              value={fontColor}
              onChange={setFontColor}
              placeholder="#1a1a1a"
            />
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-[#e5e7eb]">
          <h4 className="text-base font-medium text-[#1a1a1a] m-0">Colores de fondo</h4>
          <p className="text-xs text-[#6b7280] m-0">Opcionales. Si no los definís, se usa el color secundario.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ColorField
              label="Fondo del header"
              hint="Barra superior."
              value={headerBackgroundColor}
              onChange={setHeaderBackgroundColor}
              placeholder="#2d2d2d"
            />
            <ColorField
              label="Fondo del footer"
              hint="Pie de página."
              value={footerBackgroundColor}
              onChange={setFooterBackgroundColor}
              placeholder="#2d2d2d"
            />
            <ColorField
              label="Fondo del título (hero)"
              hint="Bloque de bienvenida."
              value={heroBackgroundColor}
              onChange={setHeroBackgroundColor}
              placeholder="#2d2d2d"
            />
            <ColorField
              label="Fondo de la página"
              hint="Secciones de contenido."
              value={pageBackgroundColor}
              onChange={setPageBackgroundColor}
              placeholder="#ffffff"
            />
          </div>
        </div>
      </Card>

      {/* Bloque 3 — Preferencias generales de la página pública */}
      {isPublicPageEnabled && (
        <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-lg font-medium text-[#1a1a1a] m-0">Preferencias generales</h3>
            <p className="text-sm text-[#6b7280] mt-2 mb-0">
              Elegí qué secciones y flujos verán tus clientes en la página pública.
            </p>
          </div>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableAlbumsPage}
                onChange={(e) => setEnableAlbumsPage(e.target.checked)}
                className="mt-0.5 w-4 h-4"
              />
              <span>
                <span className="block text-sm font-medium text-[#1a1a1a]">Mostrar mis álbumes</span>
                <span className="block text-xs text-[#6b7280] mt-0.5">
                  Acceso a tus álbumes desde la página principal.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enablePrintPage}
                onChange={(e) => setEnablePrintPage(e.target.checked)}
                className="mt-0.5 w-4 h-4"
              />
              <span>
                <span className="block text-sm font-medium text-[#1a1a1a]">Habilitar impresión</span>
                <span className="block text-xs text-[#6b7280] mt-0.5">
                  Los clientes pueden subir e imprimir sus fotos.
                </span>
              </span>
            </label>

            {enablePrintPage && (
              <div className="ml-7 space-y-3 pt-2 border-l-2 border-[#e5e7eb] pl-4">
                <p className="text-xs uppercase tracking-wide text-[#6b7280] m-0">Opciones de impresión</p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCarnetPrints}
                    onChange={(e) => setShowCarnetPrints(e.target.checked)}
                    className="mt-0.5 w-4 h-4"
                  />
                  <span className="text-sm text-[#1a1a1a]">Mostrar fotos carnet</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPolaroidPrints}
                    onChange={(e) => setShowPolaroidPrints(e.target.checked)}
                    className="mt-0.5 w-4 h-4"
                  />
                  <span className="text-sm text-[#1a1a1a]">Mostrar polaroids</span>
                </label>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] p-4">
            <p className="text-sm font-medium text-[#1a1a1a] mb-2">Tu página incluye</p>
            <ul className="text-sm text-[#6b7280] space-y-1 list-disc list-inside m-0">
              <li>Enlaces a álbumes y/o impresión según lo que habilités</li>
              <li>Tu logo y colores personalizados</li>
              <li>Footer con enlace a ComprameLaFoto</li>
            </ul>
          </div>
        </Card>
      )}

      <div className="flex justify-end pt-2">
        <Button variant="primary" onClick={onSave} disabled={loading}>
          {loading ? "Guardando…" : "Guardar preferencias y marca"}
        </Button>
      </div>
    </div>
  );
}
