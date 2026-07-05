const SESSION_DISMISS_KEY = "clf-work-location-prompt-dismissed";

export function isWorkLocationPromptDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissWorkLocationPrompt(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
  } catch {
    /* ignore quota */
  }
}

export function clearWorkLocationPromptDismiss(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_DISMISS_KEY);
  } catch {
    /* ignore */
  }
}
