import {
  Award,
  Calendar,
  Camera,
  Check,
  Clock,
  Gift,
  Heart,
  Image as ImageIcon,
  Mail,
  MapPin,
  Phone,
  Printer,
  Shield,
  Sparkles,
  Star,
  Truck,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { FeatureIcon, FeaturesBlockConfig } from "@/lib/website/blocks";
import { levelStyle } from "@/lib/website/typography";

export const FEATURE_ICON_COMPONENTS: Record<FeatureIcon, LucideIcon> = {
  camera: Camera,
  image: ImageIcon,
  video: Video,
  heart: Heart,
  star: Star,
  award: Award,
  clock: Clock,
  calendar: Calendar,
  "map-pin": MapPin,
  phone: Phone,
  mail: Mail,
  gift: Gift,
  users: Users,
  check: Check,
  sparkles: Sparkles,
  printer: Printer,
  shield: Shield,
  truck: Truck,
};

const COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3",
  6: "sm:grid-cols-3",
};

/** Íconos con texto: 2 a 6 ítems (servicios, ventajas, pasos). Los ítems sin título ni texto no
 * se dibujan; si no queda ninguno, en el sitio la sección no aparece. */
export function FeaturesBlockView({ config, data }: { config: FeaturesBlockConfig; blockId?: string; data?: unknown }) {
  const preview = data === undefined;
  const items = config.items.filter((i) => i.title.trim() || i.text.trim());
  if (items.length === 0 && !preview) return null;
  const shown = items.length > 0 ? items : config.items.map((i) => ({ ...i, title: "Título", text: "Un texto corto que lo explique." }));
  if (shown.length === 0) return null;

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        {config.title.trim() ? (
          <h2 className="text-center" style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>
            {config.title}
          </h2>
        ) : null}
        <ul className={`grid grid-cols-1 gap-8 ${COLUMNS[shown.length] ?? "sm:grid-cols-3"}`}>
          {shown.map((item, i) => {
            const Icon = FEATURE_ICON_COMPONENTS[item.icon] ?? Star;
            return (
              <li key={item.id || i} className="space-y-3 text-center">
                <span
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: "color-mix(in srgb, var(--wsite-primary) 12%, transparent)", color: "var(--wsite-primary)" }}
                >
                  <Icon aria-hidden="true" className="h-7 w-7" />
                </span>
                {item.title.trim() ? (
                  <h3 style={{ ...levelStyle("body", { color: true }), fontWeight: 700 }}>{item.title}</h3>
                ) : null}
                {item.text.trim() ? (
                  <p className="whitespace-pre-line leading-relaxed" style={{ ...levelStyle("body", { color: true }), opacity: 0.8 }}>
                    {item.text}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
