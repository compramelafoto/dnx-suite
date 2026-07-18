import { loadEnvFiles } from "../../../config/env.js";
import { runOwnerProfileValidate } from "../owner-profile-checklist.js";

loadEnvFiles();
const result = runOwnerProfileValidate();
for (const line of result.lines) console.log(line);
process.exit(result.exitCode);
