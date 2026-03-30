export type DiplomaMergeVariables = Record<string, string>;

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

export function mergeDiplomaTemplate(template: string, vars: DiplomaMergeVariables): string {
  return template.replace(PLACEHOLDER, (_, key: string) => vars[key] ?? "");
}
