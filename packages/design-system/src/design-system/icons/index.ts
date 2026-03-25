export { iconMap, type IconName } from "./catalog";

import { iconMap, type IconName } from "./catalog";

export function getIcon(name: IconName) {
  return iconMap[name];
}
