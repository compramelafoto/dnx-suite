import { existsSync } from "node:fs";
import type { PrismaExecutor } from "../client/prisma-executor.js";
import { PrismaSchemaNotFoundError } from "../errors.js";
import { getSchemaHash, parseSchemaStats } from "../parsers/index.js";
import type { SchemaStats, SchemaValidation } from "../types/index.js";
import { schemaValidationSchema } from "../types/index.js";

export class PrismaSchemaService {
  constructor(
    private readonly executor: PrismaExecutor,
    private readonly schemaPath: string,
  ) {}

  getSchemaPath(): string {
    return this.schemaPath;
  }

  schemaExists(): boolean {
    return existsSync(this.schemaPath);
  }

  assertSchemaExists(): void {
    if (!this.schemaExists()) {
      throw new PrismaSchemaNotFoundError(this.schemaPath);
    }
  }

  async validateSchema(): Promise<SchemaValidation> {
    this.assertSchemaExists();

    const result = await this.executor.run(["validate", "--schema", this.schemaPath]);

    if (result.exitCode === 0) {
      return schemaValidationSchema.parse({
        valid: true,
        message: "Schema válido",
      });
    }

    const message = `${result.stderr}\n${result.stdout}`.trim() || "Schema inválido";
    return schemaValidationSchema.parse({
      valid: false,
      message,
    });
  }

  getSchemaHash(): string {
    this.assertSchemaExists();
    return getSchemaHash(this.schemaPath);
  }

  getSchemaStats(): SchemaStats {
    this.assertSchemaExists();
    return parseSchemaStats(this.schemaPath);
  }

  async hasFormatDrift(): Promise<boolean> {
    this.assertSchemaExists();

    const result = await this.executor.run(["format", "--check", "--schema", this.schemaPath]);

    return result.exitCode !== 0;
  }
}
