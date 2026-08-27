import { InfoCard } from "./InfoCard";

type Props = {
  label: string;
  dateLabel: string | null;
};

export function DateCard({ label, dateLabel }: Props) {
  return <InfoCard label={label} value={dateLabel ?? "—"} />;
}
