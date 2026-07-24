import type { ChangeEvent, CSSProperties } from "react";
import {
  GEOGRAPHIC_SCOPES,
  geographicScopeLabel,
  type GeographicScope,
} from "../location";

export type GeoScopeSelectorProps = {
  value: GeographicScope | "" | null;
  onChange: (next: GeographicScope | "") => void;
  id?: string;
  name?: string;
  className?: string;
  style?: CSSProperties;
  required?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
};

export function GeoScopeSelector({
  value,
  onChange,
  id = "dnx-geo-scope",
  name = "geographicScope",
  className,
  style,
  required,
  disabled,
  emptyLabel = "Elegí un alcance…",
}: GeoScopeSelectorProps) {
  function handle(e: ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    onChange(v === "" ? "" : (v as GeographicScope));
  }

  return (
    <select
      id={id}
      name={name}
      value={value ?? ""}
      onChange={handle}
      className={className}
      style={style}
      required={required}
      disabled={disabled}
      data-dnx-geo="scope-selector"
      aria-label="Alcance geográfico"
    >
      <option value="">{emptyLabel}</option>
      {GEOGRAPHIC_SCOPES.map((scope) => (
        <option key={scope} value={scope}>
          {geographicScopeLabel(scope)}
        </option>
      ))}
    </select>
  );
}
