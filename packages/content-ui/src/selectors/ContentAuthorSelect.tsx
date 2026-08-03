import type { ContentOption } from "../types";
import { ContentTaxonomySelect } from "./ContentTaxonomySelect";

type ContentAuthorSelectProps = {
  label: string;
  emptyLabel: string;
  value: string;
  options: ContentOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function ContentAuthorSelect(props: ContentAuthorSelectProps) {
  return <ContentTaxonomySelect {...props} />;
}
