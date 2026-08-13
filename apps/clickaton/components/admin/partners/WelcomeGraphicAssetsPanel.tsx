import Link from "next/link";
import {
  DEFAULT_WELCOME_GRAPHIC_LIMITS,
  WELCOME_GRAPHIC_CTA_COPY,
  WELCOME_GRAPHIC_SAFE_AREA_COPY,
  WELCOME_GRAPHIC_SLOTS,
  getWelcomeGraphicSlot,
  isWelcomeGraphicAsset,
  parseWelcomeGraphicMetadata,
  slotKeyForWelcomeGraphic,
} from "@repo/partners";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { adminRoutes } from "@/config/admin/navigation";
import {
  approvePartnerAssetFormAction,
  archivePartnerAssetFormAction,
  registerPartnerAssetUrlFormAction,
} from "@/lib/admin/partners/welcome-admin-mutations";

export type WelcomeGraphicAdminAsset = {
  id: string;
  partnerId: string;
  type: string;
  fileUrl: string | null;
  approvalStatus: string;
  status: string;
  archivedAt: Date | string | null;
  altText: string | null;
  name: string | null;
  mimeType: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  metadata: unknown;
  updatedAt: Date | string;
};

function formatBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("es-AR");
}

/**
 * Selector / carga rápida en campañas. La administración canónica vive en la ficha del sponsor.
 */
export function WelcomeGraphicAssetsPanel({
  partnerId,
  assets,
}: {
  partnerId: string;
  assets: WelcomeGraphicAdminAsset[];
}) {
  const welcome = assets.filter((a) => isWelcomeGraphicAsset(a as never) && !a.archivedAt);
  const desktop = welcome.filter((a) => parseWelcomeGraphicMetadata(a.metadata)?.deviceTarget === "DESKTOP");
  const mobile = welcome.filter((a) => parseWelcomeGraphicMetadata(a.metadata)?.deviceTarget === "MOBILE");
  const hasDesktopPrimary = desktop.some((a) => {
    const m = parseWelcomeGraphicMetadata(a.metadata);
    return m?.motionVariant === "PRIMARY" && a.approvalStatus === "APPROVED";
  });
  const hasMobilePrimary = mobile.some((a) => {
    const m = parseWelcomeGraphicMetadata(a.metadata);
    return m?.motionVariant === "PRIMARY" && a.approvalStatus === "APPROVED";
  });

  return (
    <div className="space-y-6 border-t border-ck-border pt-6">
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Gráficas para ventana destacada</h3>
        <p className="text-sm text-ck-text-secondary">
          Biblioteca reutilizable del sponsor. Las campañas seleccionan piezas ya cargadas, usan las
          predeterminadas de la ficha o el logo. Tener una gráfica no autoriza su publicación sola.
        </p>
        <p>
          <Link
            href={`${adminRoutes.sponsors}/${partnerId}`}
            className="text-sm font-medium text-[#D4AF37] underline-offset-2 hover:underline"
          >
            Administrar gráficas del sponsor
          </Link>
        </p>
        <p className="text-xs text-ck-text-secondary">{WELCOME_GRAPHIC_SAFE_AREA_COPY}</p>
        <p className="text-xs text-ck-text-secondary">{WELCOME_GRAPHIC_CTA_COPY}</p>
        {welcome.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ck-border px-3 py-4 text-sm text-ck-text-secondary">
            No hay gráficas específicas; se utilizará el logo aprobado.
          </p>
        ) : null}
        {!hasDesktopPrimary || !hasMobilePrimary ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {!hasDesktopPrimary && !hasMobilePrimary
              ? "Faltan ambas piezas aprobadas. Se podrá publicar con logo aprobado, o se bloqueará si no hay logo."
              : !hasDesktopPrimary
                ? "Falta pieza de escritorio aprobada: publicable con advertencia (cross-device o logo)."
                : "Falta pieza de celular aprobada: publicable con advertencia (cross-device o logo)."}
          </p>
        ) : null}
      </div>

      <details className="rounded-lg border border-ck-border p-4">
        <summary className="cursor-pointer text-sm font-medium text-ck-text">
          Carga rápida a la biblioteca (URL) · queda PENDING
        </summary>
        <form action={registerPartnerAssetUrlFormAction} className="mt-4 space-y-4">
          <input type="hidden" name="partnerId" value={partnerId} />
          <p className="text-xs text-ck-text-secondary">
            Guarda en la biblioteca del sponsor (no como archivo aislado). Preferí subir archivo desde
            la ficha. Límites: desktop estático{" "}
            {Math.round(DEFAULT_WELCOME_GRAPHIC_LIMITS.desktopStaticMaxBytes / 1024)} KB · mobile
            estático {Math.round(DEFAULT_WELCOME_GRAPHIC_LIMITS.mobileStaticMaxBytes / 1024)} KB ·
            desktop GIF {Math.round(DEFAULT_WELCOME_GRAPHIC_LIMITS.desktopGifMaxBytes / 1024)} KB ·
            mobile GIF {Math.round(DEFAULT_WELCOME_GRAPHIC_LIMITS.mobileGifMaxBytes / 1024)} KB.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="welcome-slot" label="Variante" required>
              <Select name="welcomeSlot" defaultValue="WELCOME_GRAPHIC_DESKTOP" required>
                {WELCOME_GRAPHIC_SLOTS.map((s) => (
                  <option key={s.slotKey} value={s.slotKey}>
                    {s.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="asset-mime" label="MIME">
              <Select name="mimeType" defaultValue="image/png">
                <option value="image/png">PNG</option>
                <option value="image/webp">WebP</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/gif">GIF</option>
              </Select>
            </Field>
            <Field id="asset-url" label="URL de imagen" required>
              <Input name="fileUrl" placeholder="https://…" required />
            </Field>
            <Field id="asset-alt" label="Texto alternativo" required>
              <Input name="altText" required placeholder="Descripción de la pieza" />
            </Field>
          </div>
          <Button type="submit">Registrar en biblioteca (PENDING)</Button>
          <p className="text-xs text-ck-text-secondary">
            Reemplazar archiva la variante activa del mismo slot; el historial se conserva. No cambia
            creatives de campañas ya publicadas.
          </p>
        </form>
      </details>

      <div className="grid gap-6 lg:grid-cols-2">
        <SlotColumn
          partnerId={partnerId}
          title="Escritorio"
          description="Piezas horizontales de la biblioteca (seleccionables en campañas)."
          items={desktop}
        />
        <SlotColumn
          partnerId={partnerId}
          title="Celular"
          description="Piezas verticales/adaptadas de la biblioteca."
          items={mobile}
        />
      </div>
    </div>
  );
}

function SlotColumn({
  partnerId,
  title,
  description,
  items,
}: {
  partnerId: string;
  title: string;
  description: string;
  items: WelcomeGraphicAdminAsset[];
}) {
  return (
    <div className="space-y-3 rounded-xl border border-ck-border p-4">
      <h4 className="text-base font-semibold text-ck-text">{title}</h4>
      <p className="text-sm text-ck-text-secondary">{description}</p>
      {items.length === 0 ? (
        <p className="text-sm text-ck-text-muted">Sin pieza. Opcional · fallbacks automáticos.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => {
            const meta = parseWelcomeGraphicMetadata(a.metadata);
            const slot = meta
              ? getWelcomeGraphicSlot(slotKeyForWelcomeGraphic(meta.deviceTarget, meta.motionVariant))
              : null;
            const isGif =
              meta?.animated ||
              (a.mimeType ?? "").toLowerCase().includes("gif");
            return (
              <li key={a.id} className="space-y-3 rounded-lg border border-ck-border p-3">
                {a.fileUrl && !isGif ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.fileUrl}
                    alt={a.altText || a.name || "Miniatura"}
                    className="mx-auto max-h-28 object-contain"
                    loading="lazy"
                  />
                ) : isGif ? (
                  <p className="rounded-lg border border-dashed border-ck-border px-2 py-4 text-center text-xs text-ck-text-secondary">
                    GIF · no se descarga en el listado
                  </p>
                ) : null}
                <p className="text-sm text-ck-text">
                  {meta?.deviceTarget} ·{" "}
                  {meta?.motionVariant === "STATIC_FALLBACK" ? "fallback" : "primary"} ·{" "}
                  {isGif ? "GIF" : "estática"}
                  {meta?.isDefault ? " · predeterminada" : ""}
                </p>
                <p className="text-xs text-ck-text-secondary">
                  {a.mimeType || "mime?"} · {a.width ?? "?"}×{a.height ?? "?"} · {formatBytes(a.fileSize)}{" "}
                  · {a.altText || "sin alt"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge>{a.approvalStatus}</Badge>
                  <span className="text-xs text-ck-text-muted">{formatDate(a.updatedAt)}</span>
                </div>
                {slot ? <p className="text-xs text-ck-text-muted">{slot.recommendation}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {a.approvalStatus === "PENDING" ? (
                    <form action={approvePartnerAssetFormAction}>
                      <input type="hidden" name="partnerId" value={partnerId} />
                      <input type="hidden" name="assetId" value={a.id} />
                      <Button type="submit" variant="secondary">
                        Aprobar
                      </Button>
                    </form>
                  ) : null}
                  <form action={archivePartnerAssetFormAction}>
                    <input type="hidden" name="partnerId" value={partnerId} />
                    <input type="hidden" name="assetId" value={a.id} />
                    <Button type="submit" variant="secondary">
                      Archivar
                    </Button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
