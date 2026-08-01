import {
  moveSystemSlideAction,
  setSystemSlidesGroupEnabledAction,
  toggleSystemSlideAction,
} from "@/lib/admin/home-banners/mutations";
import type { SystemSlideAdminRow, SystemSlidesConfig } from "@/lib/admin/home-banners/system-slides";

type Props = {
  config: SystemSlidesConfig;
  editions: SystemSlideAdminRow[];
  news: SystemSlideAdminRow[];
};

function SlideRow({ row }: { row: SystemSlideAdminRow }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-ck-border py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ck-text">{row.title}</p>
        <p className="mt-1 text-sm text-ck-text-secondary">{row.subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <form action={moveSystemSlideAction} className="flex items-center gap-2">
          <input type="hidden" name="kind" value={row.kind === "news" ? "news" : "edition"} />
          <input type="hidden" name="slideId" value={row.id} />
          <button
            type="submit"
            name="direction"
            value="up"
            className="min-h-11 min-w-11 rounded border border-ck-border px-2 text-sm text-ck-yellow hover:bg-ck-surface"
            aria-label={`Subir ${row.title}`}
          >
            ↑
          </button>
          <button
            type="submit"
            name="direction"
            value="down"
            className="min-h-11 min-w-11 rounded border border-ck-border px-2 text-sm text-ck-yellow hover:bg-ck-surface"
            aria-label={`Bajar ${row.title}`}
          >
            ↓
          </button>
        </form>
        <form action={toggleSystemSlideAction}>
          <input type="hidden" name="kind" value={row.kind === "news" ? "news" : "edition"} />
          <input type="hidden" name="slideId" value={row.id} />
          <button
            type="submit"
            className={`min-h-11 rounded px-3 text-sm ${
              row.isEnabled
                ? "border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                : "border border-ck-border text-ck-text-muted hover:bg-ck-surface"
            }`}
          >
            {row.isEnabled ? "Activo" : "Deshabilitado"}
          </button>
        </form>
      </div>
    </li>
  );
}

function GroupHeader(props: {
  title: string;
  description: string;
  group: "editions" | "news";
  enabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ck-text">{props.title}</h3>
        <p className="text-sm text-ck-text-secondary">{props.description}</p>
      </div>
      <form action={setSystemSlidesGroupEnabledAction}>
        <input type="hidden" name="group" value={props.group} />
        <input type="hidden" name="enabled" value={props.enabled ? "false" : "true"} />
        <button
          type="submit"
          className={`min-h-11 rounded px-4 text-sm ${
            props.enabled
              ? "border border-ck-border text-ck-text hover:bg-ck-surface"
              : "border border-ck-yellow/50 bg-ck-yellow/10 text-ck-yellow"
          }`}
        >
          {props.enabled ? "Deshabilitar grupo" : "Habilitar grupo"}
        </button>
      </form>
    </div>
  );
}

export function SystemSlidesAdminPanel({ config, editions, news }: Props) {
  return (
    <section className="space-y-8 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-bg-elevated/40 p-6 md:p-8">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-ck-text">
          Banners de sistema
        </h2>
        <p className="text-sm text-ck-text-secondary">
          Se muestran en el Home cuando no hay banners custom activos. Podés deshabilitarlos y
          cambiar el orden.
        </p>
      </div>

      <div className="space-y-4">
        <GroupHeader
          title="Ediciones publicadas"
          description={
            config.editionsEnabled
              ? "El grupo está habilitado. Desactivá ítems individuales o todo el grupo."
              : "Grupo deshabilitado: ninguna edición aparece en el carousel automático."
          }
          group="editions"
          enabled={config.editionsEnabled}
        />
        {editions.length === 0 ? (
          <p className="text-sm text-ck-text-muted">No hay ediciones publicadas.</p>
        ) : (
          <ul className={!config.editionsEnabled ? "opacity-50" : undefined}>
            {editions.map((row) => (
              <SlideRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4 border-t border-ck-border pt-8">
        <GroupHeader
          title="Novedades del sitio"
          description={
            config.newsEnabled
              ? "Sponsor, organizar sede, cómo funciona, comunidad, etc."
              : "Grupo deshabilitado: no se muestran novedades automáticas."
          }
          group="news"
          enabled={config.newsEnabled}
        />
        <ul className={!config.newsEnabled ? "opacity-50" : undefined}>
          {news.map((row) => (
            <SlideRow key={row.id} row={row} />
          ))}
        </ul>
      </div>
    </section>
  );
}
