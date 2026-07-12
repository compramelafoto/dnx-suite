import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotenvFiles } from "./load-dotenv.js";

/**
 * Carga variables desde la raíz del package `services/dnx-mcp`,
 * independientemente del cwd desde el que se invoque el proceso
 * (raíz del monorepo, Cursor, Claude, etc.).
 */
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadDotenvFiles(packageRoot);
