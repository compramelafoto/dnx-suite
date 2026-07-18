import type { DaniStyleVersion } from "./dani-style-profile.js";
import type { DaniStyleFlag } from "./dani-style-rules.js";

export type DaniStyleResult = {
  version: DaniStyleVersion;
  score: number;
  flags: DaniStyleFlag[];
};
