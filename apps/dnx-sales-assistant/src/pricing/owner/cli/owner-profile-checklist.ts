import { loadEnvFiles } from "../../../config/env.js";
import { buildOwnerProfileChecklist } from "../owner-profile-checklist.js";

loadEnvFiles();
const result = buildOwnerProfileChecklist();
for (const line of result.lines) console.log(line);
process.exit(result.exitCode);
