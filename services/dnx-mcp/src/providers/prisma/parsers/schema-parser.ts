import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { SchemaStats } from "../types/index.js";
import { schemaStatsSchema } from "../types/index.js";

const BLOCK_PATTERN = /^(model|enum|datasource|generator)\s+(\w+)/gm;

export function readSchemaContent(schemaPath: string): string {
  return readFileSync(schemaPath, "utf8");
}

export function getSchemaHash(schemaPath: string): string {
  const content = readSchemaContent(schemaPath);
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function parseSchemaStats(schemaPath: string): SchemaStats {
  const content = readSchemaContent(schemaPath);
  const models: string[] = [];
  const enums: string[] = [];
  const datasources: string[] = [];
  const generators: string[] = [];

  for (const match of content.matchAll(BLOCK_PATTERN)) {
    const kind = match[1];
    const name = match[2];
    if (!kind || !name) {
      continue;
    }

    switch (kind) {
      case "model":
        models.push(name);
        break;
      case "enum":
        enums.push(name);
        break;
      case "datasource":
        datasources.push(name);
        break;
      case "generator":
        generators.push(name);
        break;
    }
  }

  return schemaStatsSchema.parse({
    models: [...new Set(models)].sort(),
    enums: [...new Set(enums)].sort(),
    datasources: [...new Set(datasources)].sort(),
    generators: [...new Set(generators)].sort(),
  });
}
