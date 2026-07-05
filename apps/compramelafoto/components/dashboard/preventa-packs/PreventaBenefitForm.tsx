"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { preventaSelectClassName } from "./preventa-form-controls";
import { buildBenefitDashboardSummary } from "@/lib/preventa-canjeable/benefit-copy";
import type { BenefitRow, PhotographerProductOption, TemplateOption } from "./types";

export type BenefitFormPayload = {
  kind: "DIGITAL" | "PHYSICAL";
  includedQuantity: number;
  photographerProductId: number | null;
  templatePolicy: "NONE" | "REQUIRED" | "OPTIONAL";
  templateId: number | null;
  extraUnitPriceOverrideArs: number | null;
  requiredPhotoCount: number;
  selectionMode: "SINGLE_PHOTO" | "MULTI_PHOTO_FIXED" | "ALBUM_CHOICE";
  maxPhotosPerUnit: number | null;
};

type SelectionMode = BenefitFormPayload["selectionMode"];

const KINDS: BenefitFormPayload["kind"][] = ["DIGITAL", "PHYSICAL"];
const POLICIES: BenefitFormPayload["templatePolicy"][] = ["NONE", "REQUIRED", "OPTIONAL"];

/** Valores enviados al backend sin cambiar (Prisma enums). */
const MODE_OPTIONS: { value: SelectionMode; label: string }[] = [
  { value: "SINGLE_PHOTO", label: "1 foto por cada unidad incluida" },
  { value: "MULTI_PHOTO_FIXED", label: "Varias fotos fijas por unidad" },
  { value: "ALBUM_CHOICE", label: "Elige del álbum con más libertad" },
];

const MODE_HELP: Record<SelectionMode, string> = {
  SINGLE_PHOTO:
    "Por cada uno de los incluidos en el pack, el cliente elige una sola foto del álbum. Sirve para descargas sueltas, una impresión por foto o un producto con una sola imagen.",
  MULTI_PHOTO_FIXED:
    "Por cada uno de los incluidos, el cliente tiene que elegir siempre la misma cantidad de fotos distintas. Sirve para collages, dípticos o plantillas con varios huecos.",
  ALBUM_CHOICE:
    "El cliente arma la elección con más libertad desde el álbum. Desde acá no fijás un número exacto; si hace falta, podés poner un mínimo (avanzado) o un tope más abajo.",
};

export default function PreventaBenefitForm({
  benefit,
  photographerProducts,
  templateOptions,
  saving,
  hideHeading = false,
  onCancel,
  onSubmit,
}: {
  benefit: BenefitRow | null;
  photographerProducts: PhotographerProductOption[];
  templateOptions: TemplateOption[];
  saving: boolean;
  /** Oculta el título del formulario cuando el contenedor padre ya lo indica (modal / wizard). */
  hideHeading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: BenefitFormPayload) => Promise<void>;
}) {
  const [kind, setKind] = useState<BenefitFormPayload["kind"]>("DIGITAL");
  const [includedQuantity, setIncludedQuantity] = useState("1");
  const [photographerProductId, setPhotographerProductId] = useState<string>("");
  const [templatePolicy, setTemplatePolicy] =
    useState<BenefitFormPayload["templatePolicy"]>("NONE");
  const [templateId, setTemplateId] = useState<string>("");
  const [extraUnitPriceOverrideArs, setExtraUnitPriceOverrideArs] = useState("");
  const [photosPerUnitMulti, setPhotosPerUnitMulti] = useState("4");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("SINGLE_PHOTO");
  const [maxPhotosPerUnit, setMaxPhotosPerUnit] = useState("");
  const [albumMinPhotos, setAlbumMinPhotos] = useState("1");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (benefit) {
      setKind(benefit.kind);
      setIncludedQuantity(String(benefit.includedQuantity));
      setPhotographerProductId(
        benefit.photographerProductId != null ? String(benefit.photographerProductId) : ""
      );
      setTemplatePolicy(benefit.templatePolicy);
      setTemplateId(benefit.templateId != null ? String(benefit.templateId) : "");
      setExtraUnitPriceOverrideArs(
        benefit.extraUnitPriceOverrideArs != null ? String(benefit.extraUnitPriceOverrideArs) : ""
      );
      setSelectionMode(benefit.selectionMode);
      if (benefit.selectionMode === "MULTI_PHOTO_FIXED") {
        setPhotosPerUnitMulti(String(Math.max(2, benefit.requiredPhotoCount)));
      } else {
        setPhotosPerUnitMulti("4");
      }
      setAlbumMinPhotos(String(Math.max(1, benefit.requiredPhotoCount)));
      setMaxPhotosPerUnit(
        benefit.maxPhotosPerUnit != null ? String(benefit.maxPhotosPerUnit) : ""
      );
    } else {
      setKind("DIGITAL");
      setIncludedQuantity("1");
      setPhotographerProductId("");
      setTemplatePolicy("NONE");
      setTemplateId("");
      setExtraUnitPriceOverrideArs("");
      setSelectionMode("SINGLE_PHOTO");
      setPhotosPerUnitMulti("4");
      setAlbumMinPhotos("1");
      setMaxPhotosPerUnit("");
    }
    setLocalError(null);
  }, [benefit]);

  const isPhysical = kind === "PHYSICAL";
  const showTemplateSelect =
    isPhysical && (templatePolicy === "REQUIRED" || templatePolicy === "OPTIONAL");

  const showPhotosPerUnitField = selectionMode === "MULTI_PHOTO_FIXED";
  const showMaxPhotosField = selectionMode === "ALBUM_CHOICE";
  /** Si ya guardaron un mínimo >1 en modo álbum, mostramos el campo para no perder datos. */
  const showAlbumMinPhotos =
    selectionMode === "ALBUM_CHOICE" &&
    benefit != null &&
    benefit.selectionMode === "ALBUM_CHOICE" &&
    benefit.requiredPhotoCount > 1;

  const summaryText = useMemo(() => {
    const iq = parseInt(includedQuantity, 10) || 1;
    let rpc = 1;
    if (selectionMode === "SINGLE_PHOTO") {
      rpc = 1;
    } else if (selectionMode === "MULTI_PHOTO_FIXED") {
      rpc = parseInt(photosPerUnitMulti, 10) || 2;
    } else if (showAlbumMinPhotos) {
      rpc = parseInt(albumMinPhotos, 10) || 1;
    } else if (
      benefit?.selectionMode === "ALBUM_CHOICE" &&
      selectionMode === "ALBUM_CHOICE"
    ) {
      rpc = benefit.requiredPhotoCount;
    } else {
      rpc = 1;
    }
    let max: number | null = null;
    if (selectionMode === "ALBUM_CHOICE" && maxPhotosPerUnit.trim()) {
      const m = parseInt(maxPhotosPerUnit, 10);
      if (Number.isInteger(m) && m >= 1) max = m;
    }

    const product = photographerProducts.find((p) => String(p.id) === photographerProductId);
    const photographerProductName = product
      ? `${product.name}${product.size ? ` · ${product.size}` : ""}`
      : null;
    const tpl = templateOptions.find((t) => String(t.id) === templateId);
    const templateName = tpl?.name ?? null;

    let extraOut: number | null = null;
    if (extraUnitPriceOverrideArs.trim()) {
      const x = parseInt(extraUnitPriceOverrideArs, 10);
      if (Number.isInteger(x) && x >= 0) extraOut = x;
    }

    return buildBenefitDashboardSummary({
      kind,
      includedQuantity: iq,
      selectionMode,
      requiredPhotoCount: rpc,
      maxPhotosPerUnit: selectionMode === "ALBUM_CHOICE" ? max : null,
      templatePolicy: isPhysical ? templatePolicy : "NONE",
      templateName: isPhysical && showTemplateSelect ? templateName : null,
      photographerProductName: isPhysical ? photographerProductName : null,
      extraUnitPriceOverrideArs: extraOut,
    });
  }, [
    includedQuantity,
    selectionMode,
    photosPerUnitMulti,
    albumMinPhotos,
    maxPhotosPerUnit,
    showAlbumMinPhotos,
    benefit,
    kind,
    photographerProductId,
    photographerProducts,
    templateId,
    templateOptions,
    templatePolicy,
    isPhysical,
    showTemplateSelect,
    extraUnitPriceOverrideArs,
  ]);

  function handleSelectionModeChange(next: SelectionMode) {
    setSelectionMode(next);
    if (next === "SINGLE_PHOTO") {
      setMaxPhotosPerUnit("");
    }
    if (next === "MULTI_PHOTO_FIXED") {
      setMaxPhotosPerUnit("");
      setPhotosPerUnitMulti((prev) => {
        const n = parseInt(prev, 10);
        return Number.isInteger(n) && n >= 2 ? prev : "4";
      });
    }
    if (next === "ALBUM_CHOICE") {
      setAlbumMinPhotos((prev) => {
        const n = parseInt(prev, 10);
        return Number.isInteger(n) && n >= 1 ? prev : "1";
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const iq = parseInt(includedQuantity, 10);
    if (!Number.isInteger(iq) || iq < 1) {
      setLocalError("La cantidad incluida debe ser un número entero mayor o igual a 1.");
      return;
    }

    let requiredPhotoCount = 1;
    let maxPhotos: number | null = null;

    if (selectionMode === "SINGLE_PHOTO") {
      requiredPhotoCount = 1;
      maxPhotos = null;
    } else if (selectionMode === "MULTI_PHOTO_FIXED") {
      const n = parseInt(photosPerUnitMulti, 10);
      if (!Number.isInteger(n) || n < 2) {
        setLocalError("Indicá cuántas fotos fijas por unidad (mínimo 2).");
        return;
      }
      requiredPhotoCount = n;
      maxPhotos = null;
    } else {
      if (showAlbumMinPhotos) {
        const minP = parseInt(albumMinPhotos, 10);
        if (!Number.isInteger(minP) || minP < 1) {
          setLocalError("La cantidad mínima de fotos debe ser al menos 1.");
          return;
        }
        requiredPhotoCount = minP;
      } else if (
        benefit?.selectionMode === "ALBUM_CHOICE" &&
        selectionMode === "ALBUM_CHOICE"
      ) {
        requiredPhotoCount = benefit.requiredPhotoCount;
        if (!Number.isInteger(requiredPhotoCount) || requiredPhotoCount < 1) {
          requiredPhotoCount = 1;
        }
      } else {
        requiredPhotoCount = 1;
      }
      if (maxPhotosPerUnit.trim()) {
        maxPhotos = parseInt(maxPhotosPerUnit, 10);
        if (!Number.isInteger(maxPhotos) || maxPhotos < 1) {
          setLocalError("El tope máximo de fotos debe ser un entero ≥ 1 o dejalo vacío.");
          return;
        }
      }
    }

    let photographerProductIdNum: number | null = null;
    let templatePolicyOut: BenefitFormPayload["templatePolicy"] = "NONE";
    let templateIdNum: number | null = null;
    let extraOut: number | null = null;

    if (isPhysical) {
      templatePolicyOut = templatePolicy;
      if (photographerProductId.trim()) {
        photographerProductIdNum = parseInt(photographerProductId, 10);
        if (!Number.isInteger(photographerProductIdNum)) {
          setLocalError("Producto físico inválido.");
          return;
        }
      }
      if (templatePolicyOut === "REQUIRED") {
        if (!templateId.trim()) {
          setLocalError("Con política «Obligatoria», elegí una plantilla.");
          return;
        }
        templateIdNum = parseInt(templateId, 10);
        if (!Number.isInteger(templateIdNum)) {
          setLocalError("Plantilla inválida.");
          return;
        }
      } else if (templatePolicyOut === "OPTIONAL" && templateId.trim()) {
        templateIdNum = parseInt(templateId, 10);
        if (!Number.isInteger(templateIdNum)) {
          setLocalError("Plantilla inválida.");
          return;
        }
      }
      if (extraUnitPriceOverrideArs.trim()) {
        extraOut = parseInt(extraUnitPriceOverrideArs, 10);
        if (!Number.isInteger(extraOut) || extraOut < 0) {
          setLocalError("El precio por cada extra debe ser un entero ≥ 0 o vacío.");
          return;
        }
      }
    } else {
      if (extraUnitPriceOverrideArs.trim()) {
        extraOut = parseInt(extraUnitPriceOverrideArs, 10);
        if (!Number.isInteger(extraOut) || extraOut < 0) {
          setLocalError("El precio por cada extra debe ser un entero ≥ 0 o vacío.");
          return;
        }
      }
    }

    const payload: BenefitFormPayload = {
      kind,
      includedQuantity: iq,
      photographerProductId: isPhysical ? photographerProductIdNum : null,
      templatePolicy: isPhysical ? templatePolicyOut : "NONE",
      templateId: isPhysical ? templateIdNum : null,
      extraUnitPriceOverrideArs: extraOut,
      requiredPhotoCount,
      selectionMode,
      maxPhotosPerUnit: maxPhotos,
    };

    try {
      await onSubmit(payload);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border border-[#e5e7eb] rounded-lg p-4 bg-[#fafafa] w-full max-w-none">
      {!hideHeading ? (
        <h3 className="text-sm font-semibold text-[#1a1a1a] m-0">
          {benefit ? "Editar producto incluido" : "Nuevo producto incluido"}
        </h3>
      ) : null}
      <p className="text-xs text-[#6b7280] leading-relaxed m-0">
        El producto del laboratorio es la base del impreso; acá definís <strong>qué entra en el pack</strong>{" "}
        (cuántas descargas o impresos, cómo elige fotos, plantilla y qué pasa si quiere sumar de más).
      </p>
      {localError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1.5">
          {localError}
        </p>
      )}
      <div>
        <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Tipo de entrega *</label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as BenefitFormPayload["kind"])}
          disabled={saving}
          className={preventaSelectClassName}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k === "DIGITAL" ? "Digital (archivos)" : "Físico (impresión / envío)"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#1a1a1a] mb-1">
          Cantidad incluida en el pack *
        </label>
        <Input
          type="number"
          min={1}
          value={includedQuantity}
          onChange={(e) => setIncludedQuantity(e.target.value)}
          disabled={saving}
        />
        <p className="text-xs text-[#6b7280] mt-1.5 leading-relaxed">
          Cuántas veces entra esto en lo que ya pagó el cliente (por ejemplo 10 descargas o 3
          impresos).
        </p>
      </div>

      <div className="rounded-xl border border-[#c27b3d]/25 bg-[#fef7f3]/50 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-[#1a1a1a]">Extras al canjear (opcional)</p>
          <p className="text-xs text-[#6b7280] mt-1 leading-relaxed">
            Cuando canjee, el cliente puede <strong>sumar más</strong> de este mismo producto además de lo
            que ya trae el pack. Acá fijás cuánto cobrás por cada unidad extra.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#1a1a1a] mb-1">
            Precio por cada extra ($)
          </label>
          <Input
            type="number"
            min={0}
            value={extraUnitPriceOverrideArs}
            onChange={(e) => setExtraUnitPriceOverrideArs(e.target.value)}
            disabled={saving}
            placeholder="Vacío = usar precio de lista del laboratorio al canjear"
          />
          <ul className="mt-2 space-y-1.5 text-xs text-[#4b5563] leading-relaxed list-disc pl-4 marker:text-[#c27b3d]">
            <li>
              Es <strong>aparte</strong> de lo incluido: se suma a lo que ya pagó por el pack cuando el
              cliente suma de más. No reemplaza lo que ya venía en el pack.
            </li>
            <li>
              Si lo dejás vacío, cada extra se cotiza con el precio de lista del laboratorio en el momento
              del canje (salvo otra regla en el flujo).
            </li>
          </ul>
          <p className="mt-3 text-xs text-[#374151] leading-relaxed rounded-lg bg-white/80 border border-[#e5e7eb] px-3 py-2">
            <span className="font-medium text-[#1a1a1a]">Ejemplo:</span> si ya vienen{" "}
            {Math.max(1, parseInt(includedQuantity, 10) || 1)} en el pack y el cliente suma 2 más, cobrás 2
            extras: cada uno al monto que cargues acá (o a lista del laboratorio si no cargás nada), siempre
            sumado a lo ya pagado.
          </p>
        </div>
      </div>

      {isPhysical && (
        <>
          <div>
            <label className="block text-xs font-medium text-[#1a1a1a] mb-1">
              Producto base del laboratorio (opcional)
            </label>
            <select
              value={photographerProductId}
              onChange={(e) => setPhotographerProductId(e.target.value)}
              disabled={saving}
              className={preventaSelectClassName}
            >
              <option value="">— Ninguno —</option>
              {photographerProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.size ? ` · ${p.size}` : ""}
                  {p.isActive === false ? " (inactivo)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1a1a1a] mb-1">Política de plantilla</label>
            <select
              value={templatePolicy}
              onChange={(e) =>
                setTemplatePolicy(e.target.value as BenefitFormPayload["templatePolicy"])
              }
              disabled={saving}
              className={preventaSelectClassName}
            >
              {POLICIES.map((pol) => (
                <option key={pol} value={pol}>
                  {pol === "NONE"
                    ? "Sin plantilla"
                    : pol === "REQUIRED"
                      ? "Plantilla obligatoria"
                      : "Plantilla opcional"}
                </option>
              ))}
            </select>
          </div>
          {showTemplateSelect && (
            <div>
              <label className="block text-xs font-medium text-[#1a1a1a] mb-1">
                Plantilla {templatePolicy === "REQUIRED" ? "*" : "(opcional)"}
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={saving}
                className={preventaSelectClassName}
              >
                <option value="">— Elegir —</option>
                {templateOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.group}] {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 space-y-4 shadow-sm">
        <div>
          <p className="text-sm font-medium text-[#1a1a1a]">Qué va a hacer el cliente cuando el álbum esté listo</p>
          <p className="text-xs text-[#6b7280] mt-1 leading-relaxed">
            Estas reglas se usan para elegir y completar el canje. Acá no cambiás el precio del pack; solo
            cómo elige fotos y arma el pedido.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#1a1a1a] mb-1.5">
            ¿Cómo elige las fotos por cada unidad incluida?
          </label>
          <select
            value={selectionMode}
            onChange={(e) =>
              handleSelectionModeChange(e.target.value as SelectionMode)
            }
            disabled={saving}
            className={preventaSelectClassName}
          >
            {MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-[#374151] mt-2 leading-relaxed bg-[#f9fafb] border border-[#f3f4f6] rounded-md px-3 py-2">
            {MODE_HELP[selectionMode]}
          </p>
        </div>

        {showPhotosPerUnitField && (
          <div className="pt-1 border-t border-[#f3f4f6]">
            <label className="block text-xs font-medium text-[#1a1a1a] mb-1">
              ¿Cuántas fotos por unidad?
            </label>
            <Input
              type="number"
              min={2}
              value={photosPerUnitMulti}
              onChange={(e) => setPhotosPerUnitMulti(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-[#6b7280] mt-1.5 leading-relaxed">
              Cuántas fotos distintas tiene que elegir para completar <strong>una</strong> unidad incluida
              (por ejemplo 4 para un collage de cuatro huecos).
            </p>
          </div>
        )}

        {showAlbumMinPhotos && (
          <div className="pt-1 border-t border-[#f3f4f6]">
            <label className="block text-xs font-medium text-[#1a1a1a] mb-1">
              Mínimo de fotos distintas por unidad (avanzado)
            </label>
            <Input
              type="number"
              min={1}
              value={albumMinPhotos}
              onChange={(e) => setAlbumMinPhotos(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-[#6b7280] mt-1.5 leading-relaxed">
              Este producto ya tenía un mínimo mayor a 1. Podés ajustarlo o dejarlo si tu flujo lo
              requiere.
            </p>
          </div>
        )}

        {showMaxPhotosField && (
          <div className="pt-1 border-t border-[#f3f4f6]">
            <label className="block text-xs font-medium text-[#1a1a1a] mb-1">
              Tope máximo de fotos por unidad (opcional)
            </label>
            <Input
              type="number"
              min={1}
              value={maxPhotosPerUnit}
              onChange={(e) => setMaxPhotosPerUnit(e.target.value)}
              disabled={saving}
              placeholder="Sin tope si lo dejás vacío"
            />
            <p className="text-xs text-[#6b7280] mt-1.5 leading-relaxed">
              Solo si elegiste «más libertad»: podés limitar cuántas fotos puede usar por cada uno de los
              incluidos. Dejalo vacío si no querés tope.
            </p>
          </div>
        )}

        <div className="rounded-md bg-[#fef7f3] border border-[#c27b3d]/25 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#a6692f] mb-1">
            Cómo se verá para vos
          </p>
          <p className="text-sm text-[#1a1a1a] leading-relaxed">{summaryText}</p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          Volver
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Guardando…" : benefit ? "Guardar" : "Agregar producto"}
        </Button>
      </div>
    </form>
  );
}
