/**
 * CLI: pnpm --filter infospot provision:clf-event -- --event-id <InfoSpotEventId> [--close]
 */

import { loadCliEnv } from "../clf-event-sync/load-env";
loadCliEnv();
process.env.ALLOW_CLF_WRITE_FROM_INFOSPOT =
  process.env.ALLOW_CLF_WRITE_FROM_INFOSPOT || "true";

import {
  provisionClfEventFromInfoSpot,
  closeClfPhotographerCall,
} from "./provision";

function parseArgs(argv: string[]) {
  let eventId: string | undefined;
  let close = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--close") close = true;
    else if (arg === "--event-id") {
      eventId = argv[i + 1];
      i += 1;
    } else if (arg?.startsWith("--event-id=")) {
      eventId = arg.split("=")[1];
    }
  }
  return { eventId, close };
}

async function main() {
  const { eventId, close } = parseArgs(process.argv.slice(2));
  if (!eventId) {
    console.error("Uso: --event-id <InfoSpotEventId> [--close]");
    process.exit(1);
  }
  const actorId = Number(process.env.PROVISION_ACTOR_USER_ID || "1");
  const result = close
    ? await closeClfPhotographerCall(eventId, actorId)
    : await provisionClfEventFromInfoSpot(eventId, actorId);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
