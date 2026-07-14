import { Badge } from "@/components/ui/Badge";

type AudienceGridProps = {
  items: readonly string[];
  variant?: "neutral" | "brand" | "accent";
};

export function AudienceGrid({ items, variant = "neutral" }: AudienceGridProps) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <Badge variant={variant}>{item}</Badge>
        </li>
      ))}
    </ul>
  );
}
